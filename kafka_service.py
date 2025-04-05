import json
import threading
from confluent_kafka import Producer, Consumer, KafkaError
from LiveVideoFeed import process_live_video, extract_news_with_deepseek
from cred_check import deepseek_check
import time
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Kafka configuration
KAFKA_BOOTSTRAP_SERVERS = os.environ.get('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092')

# Topics
RAW_CONTENT_TOPIC = 'raw-content'
ANALYSIS_RESULTS_TOPIC = 'analysis-results'

# Store analysis results for web app access
live_analysis_results = []
current_youtube_url = "https://www.youtube.com/watch?v=-mvUkiILTqI"  # Default URL

def get_live_analysis_results():
    """Return the current live analysis results for web app access."""
    return {
        "youtube_url": current_youtube_url,
        "results": live_analysis_results
    }

def add_analysis_result(transcript, news_item, analysis):
    """Add an analysis result to the results list"""
    global live_analysis_results
    
    result = {
        "timestamp": time.strftime('%Y-%m-%d %H:%M:%S'),
        "transcript": transcript,
        "news": news_item,
        "is_fake": analysis.get("is_fake", False),
        "verdict": analysis.get("verdict", "No verdict available"),
        "credcheck_classification": "🔴 Fake" if analysis.get("is_fake", False) else "🟢 Real"
    }
    
    # Add to the beginning of the list (most recent first)
    live_analysis_results.insert(0, result)
    
    # Limit to last 10 results
    if len(live_analysis_results) > 10:
        live_analysis_results = live_analysis_results[:10]

class KafkaProducer:
    def __init__(self):
        """Initialize Kafka producer"""
        self.producer = Producer({
            'bootstrap.servers': KAFKA_BOOTSTRAP_SERVERS
        })
        logger.info("Kafka producer initialized")
    
    def delivery_report(self, err, msg):
        """Delivery report callback for Kafka producer"""
        if err is not None:
            logger.error(f"Message delivery failed: {err}")
        else:
            logger.info(f"Message delivered to {msg.topic()} [{msg.partition()}]")
    
    def send_youtube_url(self, youtube_url):
        """Send YouTube URL to raw-content topic"""
        global current_youtube_url
        current_youtube_url = youtube_url
        
        message = {
            'type': 'youtube',
            'url': youtube_url,
            'timestamp': time.time()
        }
        
        self.producer.produce(
            RAW_CONTENT_TOPIC,
            key=f"youtube-{int(time.time())}",
            value=json.dumps(message),
            callback=self.delivery_report
        )
        self.producer.flush()
    
    def send_news_article(self, article):
        """Send news article to raw-content topic"""
        message = {
            'type': 'news',
            'article': article,
            'timestamp': time.time()
        }
        
        self.producer.produce(
            RAW_CONTENT_TOPIC,
            key=f"news-{int(time.time())}",
            value=json.dumps(message),
            callback=self.delivery_report
        )
        self.producer.flush()
    
    def send_analysis_result(self, result):
        """Send analysis result to analysis-results topic"""
        self.producer.produce(
            ANALYSIS_RESULTS_TOPIC,
            key=f"result-{int(time.time())}",
            value=json.dumps(result),
            callback=self.delivery_report
        )
        self.producer.flush()

class KafkaConsumer:
    def __init__(self, group_id):
        """Initialize Kafka consumer"""
        self.consumer = Consumer({
            'bootstrap.servers': KAFKA_BOOTSTRAP_SERVERS,
            'group.id': group_id,
            'auto.offset.reset': 'latest'
        })
        self.running = False
        logger.info(f"Kafka consumer initialized with group ID: {group_id}")
    
    def start_content_consumer(self):
        """Start consuming raw content"""
        self.consumer.subscribe([RAW_CONTENT_TOPIC])
        self.running = True
        
        thread = threading.Thread(target=self._consume_content)
        thread.daemon = True
        thread.start()
        return thread
    
    def start_results_consumer(self):
        """Start consuming analysis results"""
        self.consumer.subscribe([ANALYSIS_RESULTS_TOPIC])
        self.running = True
        
        thread = threading.Thread(target=self._consume_results)
        thread.daemon = True
        thread.start()
        return thread
    
    def stop(self):
        """Stop the consumer"""
        self.running = False
    
    def _consume_content(self):
        """Consume raw content and process it"""
        while self.running:
            msg = self.consumer.poll(1.0)
            
            if msg is None:
                continue
            
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                else:
                    logger.error(f"Consumer error: {msg.error()}")
                    continue
            
            try:
                message = json.loads(msg.value())
                message_type = message.get('type')
                
                if message_type == 'youtube':
                    # Process YouTube URL
                    url = message.get('url')
                    logger.info(f"Processing YouTube URL: {url}")
                    
                    # Process video in another thread to avoid blocking consumer
                    process_thread = threading.Thread(
                        target=self._process_youtube_video,
                        args=(url,)
                    )
                    process_thread.daemon = True
                    process_thread.start()
                
                elif message_type == 'news':
                    # Process news article
                    article = message.get('article')
                    logger.info(f"Processing news article: {article.get('title', 'Untitled')}")
                    
                    # Process article in another thread to avoid blocking consumer
                    process_thread = threading.Thread(
                        target=self._process_news_article, 
                        args=(article,)
                    )
                    process_thread.daemon = True
                    process_thread.start()
            
            except Exception as e:
                logger.error(f"Error processing message: {e}")
    
    def _consume_results(self):
        """Consume analysis results and store them"""
        logger.info("Starting consumption of analysis results from Kafka")
        while self.running:
            msg = self.consumer.poll(1.0)
            
            if msg is None:
                continue
            
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                else:
                    logger.error(f"Consumer error: {msg.error()}")
                    continue
            
            try:
                result = json.loads(msg.value())
                logger.info(f"Received analysis result from Kafka: {result.get('credcheck_classification', 'Unknown')} - {result.get('news', '')[:50]}...")
                
                # If it's a YouTube transcript analysis result
                if 'transcript' in result and 'news' in result:
                    add_analysis_result(
                        result.get('transcript', ''),
                        result.get('news', ''),
                        {
                            'is_fake': result.get('is_fake', False),
                            'verdict': result.get('verdict', 'No verdict available')
                        }
                    )
                    logger.info(f"Stored new analysis result from Kafka. Current count: {len(live_analysis_results)}")
                else:
                    logger.warning(f"Received result with missing fields: {result.keys()}")
            
            except Exception as e:
                logger.error(f"Error processing result: {e}")
                logger.exception("Full exception details:")
    
    def _process_youtube_video(self, url):
        """Process YouTube video from URL"""
        logger.info(f"Processing YouTube video in Kafka consumer: {url}")
        
        # This is a stub - actual implementation would use the LiveVideoFeed module
        # to process chunks of the video and extract transcripts
        
        # For demo, we'll create sample transcripts
        transcripts = [
            "Breaking news from Washington: The Senate has passed a new climate bill today with bipartisan support.",
            "In economic news, the Federal Reserve has announced it will maintain current interest rates.",
            "Scientists at MIT have announced a breakthrough in quantum computing technology."
        ]
        
        # Create a producer to send analysis results
        producer = KafkaProducer()
        
        for transcript in transcripts:
            # Extract news with DeepSeek
            logger.info(f"Extracting news from transcript: {transcript[:50]}...")
            news_item = extract_news_with_deepseek(transcript)
            
            if news_item:
                logger.info(f"News item detected: {news_item[:50]}...")
                # Analyze with DeepSeek
                analysis = deepseek_check(news_item)
                
                if "error" not in analysis:
                    # Send analysis result to Kafka
                    result = {
                        "timestamp": time.strftime('%Y-%m-%d %H:%M:%S'),
                        "transcript": transcript,
                        "news": news_item,
                        "is_fake": analysis.get("is_fake", False),
                        "verdict": analysis.get("verdict", "No verdict available"),
                        "credcheck_classification": "🔴 Fake" if analysis.get("is_fake", False) else "🟢 Real"
                    }
                    logger.info(f"Sending analysis result to Kafka: {result['credcheck_classification']} - {news_item[:50]}...")
                    producer.send_analysis_result(result)
                    
                    # Also directly update the live_analysis_results for immediate access
                    add_analysis_result(transcript, news_item, analysis)
                    logger.info(f"Added result to live analysis results. Current count: {len(live_analysis_results)}")
                else:
                    logger.error(f"Error in news analysis: {analysis.get('error', 'Unknown error')}")
            else:
                logger.info("No news content detected in transcript")
            
            # Simulate processing time
            time.sleep(2)  # Process faster for testing
    
    def _process_news_article(self, article):
        """Process news article"""
        # Create a producer to send analysis results
        producer = KafkaProducer()
        
        # Extract content to analyze
        title = article.get('title', '')
        
        if title:
            # Extract news with DeepSeek (or use title directly)
            news_item = title
            
            # Analyze with DeepSeek
            analysis = deepseek_check(news_item)
            
            if "error" not in analysis:
                # Send analysis result to Kafka
                result = {
                    "timestamp": time.strftime('%Y-%m-%d %H:%M:%S'),
                    "article_id": article.get('id', ''),
                    "title": title,
                    "news": news_item,
                    "is_fake": analysis.get("is_fake", False),
                    "verdict": analysis.get("verdict", "No verdict available"),
                    "credcheck_classification": "🔴 Fake" if analysis.get("is_fake", False) else "🟢 Real"
                }
                producer.send_analysis_result(result)

# Function to initialize and start Kafka services
def start_kafka_services():
    """Initialize and start Kafka consumers"""
    # Start content consumer
    content_consumer = KafkaConsumer('truthtell-content-group')
    content_thread = content_consumer.start_content_consumer()
    
    # Start results consumer
    results_consumer = KafkaConsumer('truthtell-results-group')
    results_thread = results_consumer.start_results_consumer()
    
    return content_consumer, results_consumer, content_thread, results_thread

# Example of how to integrate with the app
if __name__ == "__main__":
    # Start Kafka services
    content_consumer, results_consumer, content_thread, results_thread = start_kafka_services()
    
    # Create a producer
    producer = KafkaProducer()
    
    # Example: Send a YouTube URL for processing
    producer.send_youtube_url("https://www.youtube.com/watch?v=example")
    
    # Example: Send a news article for processing
    producer.send_news_article({
        "id": "article123",
        "title": "Scientists discover new renewable energy source",
        "source": "Science Daily"
    })
    
    # Keep the main thread running
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        # Stop consumers
        content_consumer.stop()
        results_consumer.stop()
        print("Kafka services stopped") 