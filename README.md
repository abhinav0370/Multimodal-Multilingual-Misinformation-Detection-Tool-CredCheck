# CredCheck - Multimodal-Multilingual Misinformation Detection System

![CredCheck Logo](static/images/img1.png)

CredCheck is an advanced fake news detection platform featuring a unique multilayered verification system that examines content through multiple independent analysis methods for comprehensive credibility assessment.

## 🔍 Core Features

- **Layered Verification System**: Three independent verification methods to ensure thorough analysis:
  - **Layer 1**: Credibility check against trusted sources
  - **Layer 2**: AI analysis using DeepSeek's advanced model
  - **Layer 3**: ClaimBuster fact-checking for suspicious content

- **Multiple Content Formats**:
  - Text headlines and articles
  - Images (with text extraction)
  - Audio files (with transcription)
  - Video content (with transcription)

- **Real-Time News Monitoring**: Automatically fetch and analyze news from diverse sources in real-time

- **Realtime Headlines Analysis**: Fetch and analyze current top news headlines

- **Real-Time Video Analysis**: Live video stream analysis with frame-by-frame credibility assessment from YouTube and other sources

- **Comprehensive Dashboard**: Analytics showing the distribution of real vs. fake news

- **Responsive Design**: Modern dark-themed UI that works on all devices

## 🛠️ Technology Stack

### Backend
- **Framework**: Flask (Python)
- **AI Models**: BERT embeddings, DeepSeek AI
- **Text Processing**: Whisper (for audio/video), Tesseract OCR (for images)
- **Video Processing**: YouTube API, YouTubeTranscriptApi
- **RSS Processing**: FeedParser, BeautifulSoup4
- **External APIs**: Google Search, ClaimBuster, NewsAPI, YouTube Data API

### Frontend
- **UI**: HTML5, CSS3, JavaScript
- **Data Visualization**: Chart.js
- **Design**: Modern dark theme with intuitive layered result display

## 📋 Verification Layers Explained

### Layer 1: Credibility Check
Searches for the headline across trusted news sources, evaluating:
- Presence in reputable sources
- Semantic similarity with verified content

### Layer 2: AI Analysis
Uses DeepSeek's AI model to:
- Analyze the credibility based on content patterns
- Identify hallmarks of misinformation
- Provide verdict with explanation

### Layer 3: ClaimBuster (for suspicious content)
When earlier layers flag content as potentially fake:
- Breaks down content into fact-checkable claims
- Scores each claim for factual accuracy

## 🚀 Setup Instructions

### Prerequisites
- Python 3.8+
- Tesseract OCR (for image analysis)
- API keys:
  - Google Search API + Custom Search Engine ID
  - DeepSeek API
  - ClaimBuster API
  - NewsAPI
  - YouTube API
  - Google Language API

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/credcheck.git
   cd credcheck
   ```

2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   
   # On Windows
   venv\Scripts\activate
   
   # On macOS/Linux
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables (create a `.env` file):
   ```
   # API Keys
   GOOGLE_SEARCH_API_KEY=your_api_key
   GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
   GOOGLE_LANGUAGE_API_KEY=your_language_api_key
   DEEPSEEK_API_KEY=your_deepseek_api_key
   CLAIMBUSTER_API_KEY=your_claimbuster_api_key
   CLAIMBUSTER_ENDPOINT=your_claimbuster_endpoint
   NEWS_API_KEY=your_newsapi_key
   YOUTUBE_API_KEY=your_youtube_api_key
   
   # Configuration
   DATABASE_URL=news_analysis.db
   TESSERACT_CMD=path_to_tesseract_if_needed
   PORT=5000
   ```

5. Run the application:
   ```bash
   python app.py
   ```

6. Open your browser and navigate to:
   ```
   http://127.0.0.1:5000/
   ```

## 📊 Project Structure

```
.
├── app.py                  # Main Flask application
├── cred_check.py           # Core fake news detection logic
├── deepseek.py             # DeepSeek AI integration
├── claimbuster_check.py    # ClaimBuster API integration
├── audio_to_text.py        # Audio transcription module
├── video_to_text.py        # Video transcription module
├── realTimeVideo.py        # Real-time video analysis
├── img_to_text.py          # Image text extraction module
├── convert_to_english.py   # Translation utilities
├── top_headlines.py        # News API integration
├── realTimeArticle.py      # Real-time news monitoring
├── database.py             # Database operations
├── static/                 # Static files
│   ├── css/                
│   │   └── style.css       # Modern dark-themed styling
│   ├── js/                 
│   │   └── script.js       # Frontend JavaScript
│   └── images/             # Image assets
└── templates/              
    └── index.html          # Main HTML template
```

## 📱 Usage Guide

### Analyzing Individual Content

1. **Select Input Type**:
   - Choose between Text, Image, Audio, or Video

2. **Provide Content**:
   - For text: Enter a headline or news snippet
   - For other formats: Upload the relevant file

3. **View Analysis Results**:
   - Overall classification (Real or Fake)
   - Detailed results from each verification layer
   - Explanations for each layer's verdict

### Real-Time News Feed

1. Navigate to the "Real-Time News Feed" tab in the "Real Time News Analysis" section
2. The system automatically fetches and analyzes news from diverse sources
3. Articles are displayed with their credibility status (Real or Fake)
4. News feed updates hourly with fresh content from multiple reliable sources

### Realtime Headlines Analysis

1. Click on "Fetch Top Headlines"
2. The system will retrieve current headlines and analyze each one
3. View the comprehensive analysis for each headline with details from each verification layer

### Real-Time Video Analysis

1. Navigate to the "Real-Time Video" section
2. The system fetches recent videos from configured news channels
3. Videos are transcribed and analyzed for credibility
4. Results show potential misinformation with timestamps
5. View detailed analysis of each segment with supporting evidence

### Dashboard Analytics

Scroll down to see:
- Distribution of real vs. fake news
- Recent analysis history
- Trend analysis over time

## 🔄 API Endpoints

- `/analyze_text`: Analyze text headlines
- `/analyze_image`: Extract and analyze text from images
- `/analyze_audio`: Transcribe and analyze audio content
- `/analyze_video`: Transcribe and analyze video content
- `/fetch_headlines`: Retrieve current headlines
- `/analyze_headline`: Analyze a specific headline
- `/get_real_time_news`: Retrieve real-time news articles
- `/analyze_real_time_article`: Analyze a specific real-time article
- `/get_real_time_videos`: Retrieve and analyze videos from news channels
- `/get_recent_analyses`: Retrieve recent analysis history
- `/get_statistics`: Get statistical data about analyzed content

## 🙏 Acknowledgments

- DeepSeek for providing AI capabilities
- ClaimBuster for fact-checking technology
- Google Search for source credibility assessment
- NewsAPI for current headlines
- YouTube for video content API
- Various news outlets for their RSS feeds

---

*CredCheck - Empowering users to verify the truth behind the headlines*

