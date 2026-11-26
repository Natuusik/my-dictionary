import asyncio
import os
import edge_tts # type: ignore
from supabase import create_client # type: ignore

# ==========================================
# НАСТРОЙКИ SUPABASE (вставьте ваши ключи)
# ==========================================
SUPABASE_URL = 'https://oxinddpmnblggssmcpbc.supabase.co'
SUPABASE_KEY = 'sb_publishable_buNcB1Gf3j4R0z68CwTSgQ__WHMuxFY'
BUCKET_NAME = "audio" # Название вашего бакета в Supabase Storage

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Нейросетевые голоса
VOICE_EN = "en-US-ChristopherNeural"
VOICE_RU = "ru-RU-DmitryNeural"

async def generate_and_upload():
    print("1. Подключаемся к Supabase и ищем слова без аудио...")
    
    # Загружаем слова, у которых пропущена английская или русская озвучка
    response = supabase.table("words_dictation").select("*").execute()
    words = response.data
    
    if not words:
        print("В базе нет слов.")
        return

    os.makedirs("temp_audio", exist_ok=True)
    
    for row in words:
        word_id = row["id"]
        word_en = row["word_en"]
        word_ru = row["word_ru"]
        
        audio_en_url = row.get("audio_en_url")
        audio_ru_url = row.get("audio_ru_url")
        
        updates = {}
        
        # --- 1. ГЕНЕРАЦИЯ АНГЛИЙСКОГО АУДИО (если нет) ---
        if not audio_en_url and word_en:
            print(f"Генерируем EN для слова: {word_en}")
            filename_en = f"en_{word_id}.mp3"
            local_path_en = os.path.join("temp_audio", filename_en)
            
            try:
                # Генерируем файл через edge-tts
                communicate = edge_tts.Communicate(word_en, VOICE_EN)
                await communicate.save(local_path_en)
                
                # Загружаем в Supabase Storage
                with open(local_path_en, "rb") as f:
                    supabase.storage.from_(BUCKET_NAME).upload(
                        path=filename_en,
                        file=f,
                        file_options={"upsert": "true"}
                    )
                
                # Получаем публичную ссылку
                public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(filename_en)
                updates["audio_en_url"] = public_url
                print(f"✅ Загружено EN: {public_url}")
            except Exception as e:
                print(f"❌ Ошибка EN для {word_en}: {e}")

        # --- 2. ГЕНЕРАЦИЯ РУССКОГО АУДИО (если нет) ---
        if not audio_ru_url and word_ru:
            print(f"Генерируем RU для слова: {word_ru}")
            filename_ru = f"ru_{word_id}.mp3"
            local_path_ru = os.path.join("temp_audio", filename_ru)
            
            try:
                communicate = edge_tts.Communicate(word_ru, VOICE_RU)
                await communicate.save(local_path_ru)
                
                with open(local_path_ru, "rb") as f:
                    supabase.storage.from_(BUCKET_NAME).upload(
                        path=filename_ru,
                        file=f,
                        file_options={"upsert": "true"}
                    )
                
                public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(filename_ru)
                updates["audio_ru_url"] = public_url
                print(f"✅ Загружено RU: {public_url}")
            except Exception as e:
                print(f"❌ Ошибка RU для {word_ru}: {e}")

        # --- 3. ОБНОВЛЕНИЕ ЗАПИСИ В БАЗЕ ДАННЫХ ---
        if updates:
            supabase.table("words_dictation").update(updates).eq("id", word_id).execute()
            print(f"🔄 База обновлена для слова: {word_en}\n")

    print("🎉 Синхронизация завершена! Все новые слова получили студийную озвучку.")

if __name__ == "__main__":
    asyncio.run(generate_and_upload())