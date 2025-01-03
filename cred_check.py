# cred_check.py

import os
import requests
from transformers import AutoTokenizer, AutoModel
import torch
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# Import Streamlit only if needed for logging or UI
import streamlit as st

GOOGLE_API_KEY = st.secrets["google"]["search_api_key"]
CUSTOM_SEARCH_ENGINE_ID = st.secrets["google"]["search_engine_id"]

TRUSTED_SOURCES = [
    "bbc.com", "reuters.com", "apnews.com", "snopes.com", "theguardian.com", "nytimes.com", "washingtonpost.com",
    "bbc.co.uk", "cnn.com", "forbes.com", "npr.org", "wsj.com", "time.com", "usatoday.com", "bloomberg.com",
    "thehill.com", "guardian.co.uk", "huffpost.com", "independent.co.uk", "scientificamerican.com", "wired.com",
    "nationalgeographic.com", "marketwatch.com", "businessinsider.com", "abcnews.go.com", "news.yahoo.com",
    "theverge.com", "techcrunch.com", "theatlantic.com", "axios.com", "cnbc.com", "newsweek.com", "bbc.co.uk",
    "latimes.com", "thetimes.co.uk", "sky.com", "reuters.uk", "thehindu.com", "straitstimes.com", "foreignpolicy.com",
    "dw.com", "indianexpress.com", "dailymail.co.uk", "smh.com.au", "mint.com", "livemint.com"
]

# Initializes the tokenizer and model for BERT

tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
model = AutoModel.from_pretrained("bert-base-uncased")

def get_embeddings(text):
    # Tokenizes the input text
    inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True)
    # Get model outputs
    outputs = model(**inputs)
    # Computes the mean of the last hidden states to get a fixed-size vector
    embeddings = torch.mean(outputs.last_hidden_state, dim=1)
    return embeddings.detach().numpy()

def google_search(query, num_results=5):
    url = f"https://www.googleapis.com/customsearch/v1?q={query}&key={GOOGLE_API_KEY}&cx={CUSTOM_SEARCH_ENGINE_ID}"
    response = requests.get(url)
    if response.status_code == 200:
        results = response.json().get("items", [])
        # Safely extract 'title', 'description', and 'link' using .get()
        return [
            {
                "title": item.get("title", "No Title Available"),
                "description": item.get("snippet", "No Description Available"),  # Replaced 'snippet' with 'description'
                "link": item.get("link", "No URL Available")
            }
            for item in results[:num_results]
        ]
    else:
        return {"error": f"Error {response.status_code}: {response.text}"}

def check_trusted_source(link):
    # Checks if the provided link is from a trusted source.
    for source in TRUSTED_SOURCES:
        if source in link:
            return True
    return False

def calculate_similarity(headline, search_results):
    #Calculates the cosine similarity between the headline and each search results
    headline_emb = get_embeddings(headline)
    similarities = []

    for result in search_results:
        # Combines title and description for a comprehensive comparison
        result_text = result["title"] + " " + result["description"]
        result_emb = get_embeddings(result_text)
        # Calculate cosine similarity
        similarity = cosine_similarity(headline_emb, result_emb)[0][0]
        similarities.append(similarity)

    return similarities

def enhance_credibility_score(link, headline):
    credibility_score = 0

    if check_trusted_source(link):
        credibility_score += 0.5


    return credibility_score

def fake_news_detector(headline):
    # Detects whether a news headline is fake based on similarity and credibility scores.

    search_results = google_search(headline.strip())
    if isinstance(search_results, dict) and "error" in search_results:
        return search_results

    similarities = calculate_similarity(headline, search_results)
    credibility_scores = [
        enhance_credibility_score(result["link"], result["title"]) for result in search_results
    ]

    average_similarity = float(np.mean(similarities)) if similarities else 0
    average_credibility = float(np.mean(credibility_scores)) if credibility_scores else 0
    is_fake = (average_similarity < 0.78) and (average_credibility <= 0.17)

    return {
        "headline": headline,
        "average_similarity": average_similarity,
        "average_credibility": average_credibility,
        "is_fake": bool(is_fake),
    }
