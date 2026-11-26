from fastapi import FastAPI, BackgroundTasks
import asyncio
import os
import edge_tts
from supabase import create_client

app = FastAPI()

SUPABASE_URL = "https://oxinddpmnblggssmcpbc.supabase.co"
SUPABASE_KEY = "ВАШ_СЕКРЕТНЫЙ_SERVICE_ROLE_КЛЮЧ"  # Тот самый service_role секретный ключ!
BUCKET_NAME = "voices"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

VOICE_EN = "en-US-ChristopherNeural"
VOICE_RU = "ru-RU-DmitryNeural"

async def process_audio_for_word(word_id, word_en, word_ru):
    os.makedirs("temp_audio", exist_ok=True)
    updates = {}
    
    try:
        # Генерация EN
        if word_en:
            filename_en = f"en_audio_pro/en_{word_id}.mp3"
            local_path_en = os.path.join("temp_audio", f"en_{word_id}.mp3")
            communicate = edge_tts.Communicate(word_en, VOICE_EN)
            await communicate.save(local_path_en)
            
            with open(local_path_en, "rb") as f:
                supabase.storage.from_(BUCKET_NAME).upload(path=filename_en, file=f, file_options={"upsert": "true"})
            updates["audio_en_url"] = supabase.storage.from_(BUCKET_NAME).get_public_url(filename_en)
            
        # Генерация RU
        if word_ru:
            filename_ru = f"ru_audio_pro/ru_{word_id}.mp3"
            local_path_ru = os.path.join("temp_audio", f"ru_{word_id}.mp3")
            communicate = edge_tts.Communicate(word_ru, VOICE_RU)
            await communicate.save(local_path_ru)
            
            with open(local_path_ru, "rb") as f:
                supabase.storage.from_(BUCKET_NAME).upload(path=filename_ru, file=f, file_options={"upsert": "true"})
            updates["audio_ru_url"] = supabase.storage.from_(BUCKET_NAME).get_public_url(filename_ru)
            
        if updates:
            supabase.table("words_dictation").update(updates).eq("id", word_id).execute()
            print(f"✅ Авто-оозвучка успешно создана для ID: {word_id}")
    except Exception as e:
        print(f"❌ Ошибка авто-озвучки для ID {word_id}: {e}")

@app.post("/webhook-generate-audio")
async def webhook_handler(payload: dict, background_tasks: BackgroundTasks):
    # Supabase присылает данные в поле "record" при создании новой строки
    record = payload.get("record", {})
    word_id = record.get("id")
    word_en = record.get("word_en")
    word_ru = record.get("word_ru")
    
    # Запускаем генерацию в фоновом режиме, чтобы сайт не зависал от ожидания
    background_tasks.add_task(process_audio_for_word, word_id, word_en, word_ru)
    return {"status": "processing"}