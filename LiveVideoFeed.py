import subprocess
import time
import whisper
import os
import json
import requests
from cred_check import deepseek_check
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Use the working DeepSeek API key
DEEPSEEK_API_KEY = "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"

# Load Whisper model
print("[+] Loading Whisper model...")
model = whisper.load_model("base")
print("[+] Whisper model loaded successfully.")

# Constants
CHUNK_DURATION = 90  # seconds (90 second chunks)
DEFAULT_YOUTUBE_URL = "https://www.youtube.com/watch?v=gCNeDWCI0vo"  # Default YouTube URL

# Store analysis results for web app access
live_analysis_results = []

def get_live_analysis_results():
    """
    Return the current live analysis results for web app access.
    
    Returns:
        dict: Dictionary containing YouTube URL and analysis results
    """
    return {
        "youtube_url": DEFAULT_YOUTUBE_URL,
        "results": live_analysis_results
    }

def add_analysis_result(transcript, news_item, analysis):
    """
    Add an analysis result to the results list
    
    Args:
        transcript (str): Original transcript
        news_item (str): Extracted news
        analysis (dict): Analysis result from DeepSeek
    """
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
            print(f"[+] Skipping duplicate news item: {news_item[:50]}...")
            return
    
    # Add to the beginning of the list (most recent first)
    live_analysis_results.insert(0, result)
    
    # Limit to last 10 results
    if len(live_analysis_results) > 10:
        live_analysis_results = live_analysis_results[:10]

def extract_news_with_deepseek(transcript):
    """
    Use DeepSeek AI to extract a news item from the transcript if one exists.
    
    Args:
        transcript (str): The transcribed text from the video chunk
        
    Returns:
        str or None: The extracted news item or None if no news was found
    """
    try:
        # Construct prompt for news extraction
        prompt = f"""
You are a specialized news extraction AI. Analyze the following transcript from a media source and extract ONE SINGLE news item if it exists.
A news item typically reports on a current event, has factual statements, mentions specific people, places, or events.

Transcript:
{transcript}

If there is a news item in the transcript, extract it completely and faithfully.
If there is more than one news item, extract only the most important or complete one.
If there is no clear news item, respond with "NO_NEWS_FOUND".

Extract only the news item text with no additional commentary or explanation.
"""

        # Call DeepSeek API
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://credcheck.example.com",
                "X-Title": "CredCheck"
            },
            data=json.dumps({
                "model": "deepseek/deepseek-r1-zero:free",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a specialized news extraction AI that can identify and extract news content from transcripts."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
            })
        )

        if response.status_code != 200:
            print(f"[-] API error: {response.status_code}")
            return None

        result = response.json()
        if "choices" not in result or len(result["choices"]) == 0:
            print("[-] No choices in API response")
            return None
            
        if "message" not in result["choices"][0]:
            print("[-] No message in API response choice")
            return None
            
        # Extract the content from the response
        content = result["choices"][0]["message"]["content"].strip()
        
        # Check if news was found
        if content == "NO_NEWS_FOUND":
            return None
            
        return content
        
    except Exception as e:
        print(f"[-] Error extracting news: {e}")
        return None

def show_dependencies_error():
    """
    Show error message when required dependencies for live video processing are missing.
    """
    print("[!] ERROR: Dependencies for live video processing are missing")
    print("[!] This system requires real-time transcripts from actual video content")
    print("[!] Please install the following dependencies:")
    print("    - yt-dlp: pip install yt-dlp")
    print("    - ffmpeg: Download from https://ffmpeg.org/download.html and add to PATH")
    
    # Add a single result explaining the error
    add_analysis_result(
        "Dependency error", 
        "Live broadcast analysis requires yt-dlp and ffmpeg to be installed on the system.",
        {
            "is_fake": False,
            "verdict": "Please install the required dependencies to enable live broadcast analysis."
        }
    )
    
    return []

def process_live_video():
    """
    Process a live YouTube video by extracting audio and transcribing it in chunks.
    Falls back to error message if YouTube processing is not available.
    """
    video_url = DEFAULT_YOUTUBE_URL
    news_count = 0
    chunk_count = 0
    
    # Try to import yt-dlp, if not available, show error
    try:
        import yt_dlp
        have_yt_dlp = True
        print("[+] yt-dlp package found, will attempt to process YouTube video")
    except ImportError:
        have_yt_dlp = False
        print("[-] yt-dlp package not found")
        print("[-] Install yt-dlp with: pip install yt-dlp")
    
    # Check if ffmpeg is available
    have_ffmpeg = False
    try:
        result = subprocess.run(["ffmpeg", "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if result.returncode == 0:
            have_ffmpeg = True
            print("[+] ffmpeg found, will use it for audio processing")
    except:
        print("[-] ffmpeg not found in PATH")
    
    # If either yt-dlp or ffmpeg is missing, show error and exit
    if not have_yt_dlp or not have_ffmpeg:
        print("[!] Cannot process live video due to missing dependencies")
        return show_dependencies_error()

    # If we have all required dependencies, process actual YouTube video
    try:
        print(f"[+] Fetching info for YouTube video: {video_url}")
        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            stream_url = info['url']
            print(f"[+] Stream URL acquired")
            
        while True:
            chunk_file = f"chunk_{chunk_count}.wav"

            print(f"[+] Recording chunk {chunk_count}...")

            # ffmpeg command: record audio chunk from the stream
            ffmpeg_cmd = [
                "ffmpeg", "-y",
                "-i", stream_url,
                "-t", str(CHUNK_DURATION),
                "-ac", "1",         # mono channel
                "-ar", "16000",     # sample rate for Whisper
                "-f", "wav",
                chunk_file
            ]

            # Run ffmpeg silently
            subprocess.run(ffmpeg_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            # Check if chunk was saved
            if not os.path.exists(chunk_file):
                print(f"[-] Failed to record chunk {chunk_count}. Skipping...")
                chunk_count += 1
                continue

            print(f"[+] Transcribing chunk {chunk_count} with Whisper...")

            # Transcribe
            result = model.transcribe(chunk_file)
            transcript = result["text"]
            print(f"[Transcript chunk {chunk_count}]:\n{transcript}\n")

            # Extract news from transcript using DeepSeek
            print("[+] Extracting news with DeepSeek AI...")
            news_item = extract_news_with_deepseek(transcript)
            
            if news_item:
                news_count += 1
                print(f"[+] News item {news_count} detected:")
                print(f"[News]: {news_item}\n")
                
                # Analyze the news item with DeepSeek for fake/real classification
                print("[+] Analyzing news credibility with DeepSeek AI...")
                analysis = deepseek_check(news_item)
                
                if "error" in analysis:
                    print(f"[-] Analysis error: {analysis['error']}")
                else:
                    verdict = analysis['verdict']
                    is_fake = analysis['is_fake']
                    
                    print(f"[Result]: {'FAKE' if is_fake else 'REAL'} news")
                    print(f"[Verdict]: {verdict}\n")
                    
                    # Save to file for record keeping
                    with open("live_news_analysis.txt", "a", encoding="utf-8") as f:
                        f.write(f"Time: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                        f.write(f"News: {news_item}\n")
                        f.write(f"Classification: {'FAKE' if is_fake else 'REAL'}\n")
                        f.write(f"Verdict: {verdict}\n")
                        f.write("-" * 80 + "\n\n")
                    
                    # Add to web results
                    add_analysis_result(transcript, news_item, analysis)
            else:
                print("[-] No news content detected in this chunk. Skipping analysis.\n")

            # Optional: Delete the audio chunk to save space
            if os.path.exists(chunk_file):
                os.remove(chunk_file)

            chunk_count += 1
            
    except KeyboardInterrupt:
        print("\n[!] Stopped by user.")
    except Exception as e:
        print(f"\n[-] Error in live video processing: {e}")
        print("[!] Cannot continue with video processing due to error")
        
        # Clean up any chunk files
        for file in os.listdir():
            if file.startswith("chunk_") and file.endswith(".wav"):
                try:
                    os.remove(file)
                except:
                    pass
                    
        # Show error instead of using sample news
        return show_dependencies_error()

# Function to run the live video process in a separate thread
def start_live_video_process_in_background():
    """
    Start the live video process in a background thread
    """
    import threading
    thread = threading.Thread(target=process_live_video)
    thread.daemon = True  # Thread will exit when main program exits
    thread.start()
    return thread

if __name__ == "__main__":
    print("[+] Starting news analysis from live YouTube stream")
    print("[+] Press Ctrl+C to stop the analysis")
    print("[+] Analysis results will be saved to live_news_analysis.txt")
    process_live_video() 