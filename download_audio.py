import os
import requests

# 1. Список ваших слов (можете добавить сюда любые свои слова на английском)
words = [
    "apple", 
    "banana", 
    "success", 
    "developer", 
    "journey", 
    "knowledge", 
    "confidence", 
    "achieve"
]

# Создаём папку 'en_audio' на компьютере, куда сохранятся файлы
output_dir = "en_audio"
os.makedirs(output_dir, exist_ok=True)

print(f"Начинаю скачивание озвучки для {len(words)} слов...")

for word in words:
    # Официальный публичный URL сервиса Google Translate TTS для качественной озвучки
    url = f"https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&tl=en&q={word}"
    
    headers = {"User-Agent": "Mozilla/5.0"}
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            file_path = os.path.join(output_dir, f"{word}.mp3")
            with open(file_path, "wb") as f:
                f.write(response.content)
            print(f"✅ Успешно скачано: {word}.mp3")
        else:
            print(f"❌ Ошибка для слова '{word}' (Код: {response.status_code})")
    except Exception as e:
        print(f"❌ Ошибка соединения для '{word}': {e}")

print("\nГотово! Все файлы сохранены в папке:", os.path.abspath(output_dir))