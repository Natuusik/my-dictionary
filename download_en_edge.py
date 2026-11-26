import asyncio
import os
import edge_tts

# Список ваших английских слов для озвучки
english_vocabulary = {
    "apple": "apple",
    "achieve": "achieve",
    "confidence": "confidence",
    "success": "success",
    "developer": "developer",
    "journey": "journey",
    "knowledge": "knowledge",
    "banana": "banana"
}

# Выбираем крутой английский голос:
# Мужской: "en-US-ChristopherNeural" (или "en-GB-RyanNeural" для британского)
# Женский: "en-US-AriaNeural"
VOICE = "en-US-ChristopherNeural"

output_dir = "en_audio_pro"

async def generate_english_audio():
    os.makedirs(output_dir, exist_ok=True)
    print(f"Генерируем английскую озвучку для {len(english_vocabulary)} слов (голос: {VOICE})...\n")
    
    for en_name in english_vocabulary.keys():
        file_path = os.path.join(output_dir, f"{en_name}.mp3")
        try:
            communicate = edge_tts.Communicate(en_name, VOICE)
            await communicate.save(file_path)
            print(f"✅ Успешно: {en_name}.mp3")
        except Exception as e:
            print(f"❌ Ошибка для слова '{en_name}': {e}")
            
    print(f"\nГотово! Английские файлы сохранены в папку: {os.path.abspath(output_dir)}")

if __name__ == "__main__":
    asyncio.run(generate_english_audio())