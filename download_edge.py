import asyncio
import os
import edge_tts

# Словарь: английское имя файла -> русский текст для озвучки
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

# Выбираем голос: 
# Мужской: "ru-RU-DmitryNeural"
# Женский: "ru-RU-SvetlanaNeural"
VOICE = "ru-RU-DmitryNeural"

output_dir = "ru_audio_pro"

async def generate_audio():
    os.makedirs(output_dir, exist_ok=True)
    print(f"Генерируем профессиональную озвучку для {len(vocabulary)} слов (голос: {VOICE})...\n")
    
    for en_name, ru_word in vocabulary.items():
        file_path = os.path.join(output_dir, f"{en_name}.mp3")
        try:
            # Создаем объект синтеза речи Edge TTS
            communicate = edge_tts.Communicate(ru_word, VOICE)
            # Сохраняем в файл MP3
            await communicate.save(file_path)
            print(f"✅ Успешно: {en_name}.mp3 -> '{ru_word}'")
        except Exception as e:
            print(f"❌ Ошибка для слова '{ru_word}': {e}")
            
    print(f"\nГотово! Нейросетевые файлы сохранены в папку: {os.path.abspath(output_dir)}")

# Запуск асинхронной функции
if __name__ == "__main__":
    asyncio.run(generate_audio())