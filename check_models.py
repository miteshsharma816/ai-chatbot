import google.generativeai as genai

API_KEY = "AIzaSyAUaKJWU0gsNJ_DkC91fBSJ3riH2M_0B7Q"
genai.configure(api_key=API_KEY)

with open('available_models.txt', 'w') as f:
    f.write("Available models that support generateContent:\n\n")
    
    try:
        for model in genai.list_models():
            if 'generateContent' in model.supported_generation_methods:
                f.write(f"Name: {model.name}\n")
                f.write(f"Display Name: {model.display_name}\n")
                f.write("-" * 50 + "\n")
        print("Models written to available_models.txt")
    except Exception as e:
        f.write(f"Error: {e}\n")
        print(f"Error: {e}")
