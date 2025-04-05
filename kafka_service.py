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
current_youtube_url = "https://www.youtube.com/watch?v=gCNeDWCI0vo"  # Default URL

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
    
    # Check for duplicate news items
    # Skip adding if the same news item already exists in the list
    for existing_result in live_analysis_results:
        if existing_result.get("news") == news_item:
            logger.info(f"Skipping duplicate news item: {news_item[:50]}...")
            return
    
    # If this is a real news item (not a processing message or error), 
    # remove any "Processing video" messages to clean up the display
    if not news_item.startswith("Processing video:") and not news_item.startswith("Dependency error") and not news_item.startswith("Processing Error"):
        # Filter out processing messages from the same video
        filtered_results = []
        for existing_result in live_analysis_results:
            existing_news = existing_result.get("news", "")
            if not existing_news.startswith("Processing video:"):
                filtered_results.append(existing_result)
            else:
                logger.info(f"Removing processing message as real analysis is now available")
        live_analysis_results = filtered_results
    
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
        """Process YouTube video from URL and extract real transcripts"""
        logger.info(f"Processing YouTube video in Kafka consumer: {url}")
        
        # Try to import yt-dlp and check ffmpeg (required for actual processing)
        have_dependencies = True
        try:
            import yt_dlp
        except ImportError:
            logger.error("yt-dlp package not found - cannot process YouTube video")
            have_dependencies = False
        
        # Check if ffmpeg is available
        try:
            import subprocess
            result = subprocess.run(["ffmpeg", "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if result.returncode != 0:
                logger.error("ffmpeg not found in PATH - cannot process YouTube video")
                have_dependencies = False
        except:
            logger.error("Error checking for ffmpeg - cannot process YouTube video")
            have_dependencies = False
        
        if not have_dependencies:
            # Add a single result explaining the error
            add_analysis_result(
                "Dependency error", 
                "Live broadcast analysis requires yt-dlp and ffmpeg to be installed on the system.",
                {
                    "is_fake": False,
                    "verdict": "Please install the required dependencies to enable live broadcast analysis."
                }
            )
            logger.info("Added dependency error message to live broadcast results")
            return
        
        # Import whisper for transcription
        try:
            import whisper
            import os
            model = whisper.load_model("base")
            logger.info("Loaded Whisper model for transcription")
        except ImportError:
            logger.error("Whisper library not found - cannot process audio")
            add_analysis_result(
                "Dependency error", 
                "Live broadcast analysis requires the Whisper library for transcription.",
                {
                    "is_fake": False,
                    "verdict": "Please install the Whisper library: pip install openai-whisper"
                }
            )
            return
        
        # Create a producer to send results later
        producer = KafkaProducer()
        
        # Process the video
        try:
            logger.info(f"Fetching stream URL for YouTube video: {url}")
            
            # Define options for yt-dlp
            ydl_opts = {
                'format': 'bestaudio/best',
                'quiet': True,
                'no_warnings': True,
            }
            
            # Get stream URL
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                stream_url = info['url']
                video_title = info.get('title', 'Untitled video')
                logger.info(f"Successfully acquired stream URL for: {video_title}")
                
                # Check if there's already a processing message from this video in the results
                processing_exists = False
                for result in live_analysis_results:
                    if result.get('news', '').startswith(f"Processing video:") and video_title in result.get('news', ''):
                        processing_exists = True
                        break
                
                # Only add initial status update if no processing message exists
                if not processing_exists:
                    add_analysis_result(
                        "Processing started", 
                        f"Processing video: {video_title}",
                        {
                            "is_fake": False,
                            "verdict": "Analysis of video content has begun. Results will appear shortly."
                        }
                    )
                    logger.info("Added initial processing message for video")
            
            # Process in chunks (similar to LiveVideoFeed.py but without sample news)
            chunk_count = 0
            news_count = 0
            max_chunks = 5  # Limit number of chunks to process
            
            # Set chunk duration for processing
            chunk_duration = 60  # seconds
            
            while chunk_count < max_chunks:
                chunk_file = f"chunk_{chunk_count}.wav"
                
                # Record a chunk from the stream
                logger.info(f"Recording chunk {chunk_count} from stream...")
                ffmpeg_cmd = [
                    "ffmpeg", "-y",
                    "-i", stream_url,
                    "-t", str(chunk_duration),
                    "-ac", "1",         # mono channel
                    "-ar", "16000",     # sample rate for Whisper
                    "-f", "wav",
                    chunk_file
                ]
                
                # Run ffmpeg silently
                subprocess.run(ffmpeg_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                
                # Check if chunk was saved
                if not os.path.exists(chunk_file):
                    logger.error(f"Failed to record chunk {chunk_count}. Skipping...")
                    chunk_count += 1
                    continue
                
                # Transcribe the chunk with Whisper
                logger.info(f"Transcribing chunk {chunk_count} with Whisper...")
                result = model.transcribe(chunk_file)
                transcript = result["text"]
                logger.info(f"Transcription complete: {transcript[:100]}...")
                
                # Extract news from transcript
                logger.info("Extracting news content from transcript...")
                news_item = extract_news_with_deepseek(transcript)
                
                if news_item:
                    news_count += 1
                    logger.info(f"News item {news_count} detected: {news_item[:100]}...")
                    
                    # Analyze the news item with DeepSeek
                    logger.info("Analyzing news credibility...")
                    analysis = deepseek_check(news_item)
                    
                    if "error" not in analysis:
                        verdict = analysis.get('verdict', 'No verdict available')
                        is_fake = analysis.get('is_fake', False)
                        
                        logger.info(f"Analysis result: {'FAKE' if is_fake else 'REAL'} news")
                        logger.info(f"Verdict: {verdict[:100]}...")
                        
                        # Send analysis result to Kafka
                        result = {
                            "timestamp": time.strftime('%Y-%m-%d %H:%M:%S'),
                            "transcript": transcript,
                            "news": news_item,
                            "is_fake": is_fake,
                            "verdict": verdict,
                            "credcheck_classification": "🔴 Fake" if is_fake else "🟢 Real"
                        }
                        
                        logger.info(f"Sending analysis result to Kafka: {result['credcheck_classification']} - {news_item[:50]}...")
                        producer.send_analysis_result(result)
                        
                        # Also directly update the live_analysis_results for immediate access
                        add_analysis_result(transcript, news_item, analysis)
                        logger.info(f"Added result to live analysis results. Current count: {len(live_analysis_results)}")
                    else:
                        logger.error(f"Error in news analysis: {analysis.get('error', 'Unknown error')}")
                else:
                    logger.info("No news content detected in this transcript. Skipping analysis.")
                
                # Delete the audio chunk to save space
                if os.path.exists(chunk_file):
                    os.remove(chunk_file)
                    logger.info(f"Removed temporary file: {chunk_file}")
                
                # Increment counter and wait briefly before next chunk
                chunk_count += 1
                time.sleep(1)
            
            if news_count == 0:
                # If no news was found in any chunks
                add_analysis_result(
                    "No news detected", 
                    f"Processed {chunk_count} segments of video: {video_title}",
                    {
                        "is_fake": False,
                        "verdict": "No news content was detected in the processed video segments."
                    }
                )
                logger.info("No news content was detected in any of the processed video segments")
            
        except Exception as e:
            logger.error(f"Error processing YouTube video: {e}")
            logger.exception("Full error details:")
            
            # Clean up any temporary files
            for file in os.listdir("."):
                if file.startswith("chunk_") and file.endswith(".wav"):
                    try:
                        os.remove(file)
                    except:
                        pass
            
            # Add error message to results
            add_analysis_result(
                "Processing Error", 
                f"Error processing YouTube URL: {url}",
                {
                    "is_fake": False,
                    "verdict": f"An error occurred while processing the video: {str(e)}"
                }
            )
            logger.info("Added error message to live broadcast results")
    
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
    producer.send_youtube_url("https://www.youtube.com/watch?v=gCNeDWCI0vo")
    print("Test URL sent to Kafka for processing")
    
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