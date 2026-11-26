import os
import requests

# Словарь: английское имя файла -> русский перевод для озвучки
vocabulary = {
    "apple": "яблоко",
    "banana": "банан",
    "success": "успех",
    "developer": "разработчик",
    "journey": "путешествие",
    "knowledge": "знание",
    "confidence": "уверенность",
    "achieve": "достигать"
}

output_dir = "ru_audio"
os.makedirs(output_dir, exist_ok=True)

print(f"Скачиваю русскую озвучку для {len(vocabulary)} слов...")

for en_name, ru_word in vocabulary.items():
    # Параметр tl=ru задает русский язык озвучки
    url = f"https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&tl=ru&q={ru_word}"
    headers = {"User-Agent": "Mozilla/5.0"}
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            # Сохраняем файл под английским именем (например, achieve.mp3)
            file_path = os.path.join(output_dir, f"{en_name}.mp3")
            with open(file_path, "wb") as f:
                f.write(response.content)
            print(f"✅ Успешно скачано (RU): {en_name}.mp3 ({ru_word})")
        else:
            print(f"❌ Ошибка для слова '{ru_word}'")
    except Exception as e:
        print(f"❌ Ошибка соединения: {e}")

print("\nГотово! Русские файлы сохранены в папке:", os.path.abspath(output_dir))
