# Multimodal and Multilingual Misinformation Detection Tool-CredCheck

A comprehensive web application designed to detect fake news from various inputs such as text, audio, images, and videos.

## Functionalities

- **Text Analysis**: Analyze news headlines to determine their credibility.
- **Audio Analysis**: Upload audio files, transcribe them, and analyze the transcribed text.
- **Image Analysis**: Upload images, extract text using OCR, and analyze the extracted content.
- **Video Analysis**: Upload videos, extract audio, transcribe the audio, and analyze the transcribed text.
- **Real-Time News Analysis and Dashboard**: Fetch and analyze top news headlines in real-time and displays the analysed metrics and graphs on dashboard.

## Installation

### Prerequisites

- **Python 3.7 or higher**
- **FFmpeg**: Required for audio and video processing
- **Tesseract OCR**: Required for image text extraction

### Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/abhinav0370/Multimodal-Multilingual-Misinformation-Detection-Tool-CredCheck.git
   ```

2. **Create a Virtual Environment**
   ```bash
   python -m venv venv

   Activation
   
   On Mac: source venv/bin/activate
   
   On Windows: venv\Scripts\activate
   ```

3. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```



### Additional Software Installation

#### FFmpeg
- **Windows**: Download from [FFmpeg Official Website](https://ffmpeg.org/download.html), extract the archive, and add the bin folder to your system's PATH
- **macOS**: 
  ```bash
  brew install ffmpeg
  ```
- **Linux (Debian/Ubuntu)**:
  ```bash
  sudo apt-get update
  sudo apt-get install ffmpeg
  ```

#### Tesseract OCR
- **Windows**: Download the installer from [Tesseract OCR GitHub](https://github.com/UB-Mannheim/tesseract/wiki), install it, and add the installation directory to your system's PATH
- **macOS**: 
  ```bash
  brew install tesseract
  ```
- **Linux (Debian/Ubuntu)**:
  ```bash
  sudo apt-get update
  sudo apt-get install tesseract-ocr
  ```

### Configuration

#### API Keys

You'll need to obtain the following API keys:
- Google Generative AI API Key (from Google Cloud Console)
- ClaimBuster API Key
- Google Custom Search Engine ID
- NewsAPI Api Key 


## Usage

Run the Streamlit application:

```bash
streamlit run main.py
```

### Features

- **Analyze Headline**: Choose between Text, Audio, Image, or Video input methods to analyze news headlines for credibility.
- **Real-Time News Analysis**: Fetch and analyze the top news headlines in real-time.

### Acknowledgements
This project leverages technologies and services from:

- Streamlit
- ClaimBuster
- Google Generative AI
- Scikit-learn
- FFmpeg
- Tesseract OCR
- PyTorch
- Whisper

