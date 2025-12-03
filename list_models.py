import google.generativeai as genai
import google.generativeai as genai
import os

# Use the key from app.py (hardcoded for now as per user's file)
API_KEY = "AIzaSyAUaKJWU0gsNJ_DkC91fBSJ3riH2M_0B7Q"
genai.configure(api_key=API_KEY)

print("Listing available models that support generateContent:\n")
try:
    for model in genai.list_models():
        if 'generateContent' in model.supported_generation_methods:
            print(f"✓ {model.name}")

    print("\n=== Use one of the models above in app.py ===")
except Exception as e:
    print(f"Error: {e}")
