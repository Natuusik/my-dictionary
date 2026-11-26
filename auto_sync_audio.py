import asyncio
import os
import edge_tts
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
BUCKET_NAME = "voices"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

VOICE_EN = "en-US-ChristopherNeural"
VOICE_RU_MALE = "ru-RU-DmitryNeural"
VOICE_RU_FEMALE = "ru-RU-SvetlanaNeural"

async def generate_and_upload():
    print("1. Подключаемся к Supabase и забираем все слова...")
    response = supabase.table("words_dictation").select("*").execute()
    words = response.data
    
    if not words:
        print("❌ В таблице words_dictation вообще нет записей!")
        return

    print(f"Найдено слов: {len(words)}")
    os.makedirs("temp_audio", exist_ok=True)
    
    for row in words:
        word_id = row.get("id")
        word_en = row.get("word_en")
        word_ru = row.get("word_ru")
        
        audio_en_url = row.get("audio_en_url")
        audio_ru_url = row.get("audio_ru_url")
        audio_ru_female_url = row.get("audio_ru_female_url")
        
        updates = {}
        
        # 1. Английский
        if not audio_en_url and word_en:
            print(f"🎙 Генерируем EN: {word_en}")
            filename_en = f"en_audio_pro/en_{word_id}.mp3"
            local_path_en = os.path.join("temp_audio", f"en_{word_id}.mp3")
            try:
                communicate = edge_tts.Communicate(word_en, VOICE_EN)
                await communicate.save(local_path_en)
                with open(local_path_en, "rb") as f:
                    supabase.storage.from_(BUCKET_NAME).upload(
                        path=filename_en, file=f, file_options={"upsert": "true"}
                    )
                updates["audio_en_url"] = supabase.storage.from_(BUCKET_NAME).get_public_url(filename_en)
            except Exception as e:
                print(f"❌ Ошибка EN: {e}")
                
        # 2. Русский (Мужской)
        if not audio_ru_url and word_ru:
            print(f"🎙 Генерируем RU (мужской) для: {word_ru}")
            filename_ru = f"ru_audio_pro/ru_{word_id}.mp3"
            local_path_ru = os.path.join("temp_audio", f"ru_{word_id}.mp3")
            try:
                communicate = edge_tts.Communicate(word_ru, VOICE_RU_MALE)
                await communicate.save(local_path_ru)
                with open(local_path_ru, "rb") as f:
                    supabase.storage.from_(BUCKET_NAME).upload(
                        path=filename_ru, file=f, file_options={"upsert": "true"}
                    )
                updates["audio_ru_url"] = supabase.storage.from_(BUCKET_NAME).get_public_url(filename_ru)
            except Exception as e:
                print(f"❌ Ошибка RU мужской: {e}")

        # 3. Русский (Женский)
        if not audio_ru_female_url and word_ru:
            print(f"🎙 Генерируем RU (женский) для: {word_ru}")
            filename_ru_fem = f"ru_audio_female/ru_fem_{word_id}.mp3"
            local_path_ru_fem = os.path.join("temp_audio", f"ru_fem_{word_id}.mp3")
            try:
                communicate = edge_tts.Communicate(word_ru, VOICE_RU_FEMALE)
                await communicate.save(local_path_ru_fem)
                with open(local_path_ru_fem, "rb") as f:
                    supabase.storage.from_(BUCKET_NAME).upload(
                        path=filename_ru_fem, file=f, file_options={"upsert": "true"}
                    )
                updates["audio_ru_female_url"] = supabase.storage.from_(BUCKET_NAME).get_public_url(filename_ru_fem)
            except Exception as e:
                print(f"❌ Ошибка RU женский: {e}")
                
        if updates:
            supabase.table("words_dictation").update(updates).eq("id", word_id).execute()
            print(f"🔄 База Supabase обновлена для ID: {word_id}\n")

    print("🎉 Синхронизация завершена!")

if __name__ == "__main__":
    asyncio.run(generate_and_upload())
