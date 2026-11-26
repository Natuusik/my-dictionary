import asyncio
import os
import edge_tts
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
BUCKET_NAME = "voices"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

VOICE_EN = "en-US-ChristopherNeural"
VOICE_RU = "ru-RU-DmitryNeural"


async def generate_and_upload():
  print("1. Подключаемся к Supabase и ищем слова без аудио...")
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

    if not audio_en_url and word_en:
      print(f"Генерируем EN для слова: {word_en}")
      filename_en = f"en_audio_pro/en_{word_id}.mp3"
      local_path_en = os.path.join("temp_audio", f"en_{word_id}.mp3")
      try:
        communicate = edge_tts.Communicate(word_en, VOICE_EN)
        await communicate.save(local_path_en)
        with open(local_path_en, "rb") as f:
          supabase.storage.from_(BUCKET_NAME).upload(
              path=filename_en, file=f, file_options={"upsert": "true"}
          )
        updates["audio_en_url"] = supabase.storage.from_(
            BUCKET_NAME
        ).get_public_url(filename_en)
        print(f"✅ Загружено EN: {word_en}")
      except Exception as e:
        print(f"❌ Ошибка EN для {word_en}: {e}")

    if not audio_ru_url and word_ru:
      print(f"Генерируем RU для слова: {word_ru}")
      filename_ru = f"ru_audio_pro/ru_{word_id}.mp3"
      local_path_ru = os.path.join("temp_audio", f"ru_{word_id}.mp3")
      try:
        communicate = edge_tts.Communicate(word_ru, VOICE_RU)
        await communicate.save(local_path_ru)
        with open(local_path_ru, "rb") as f:
          supabase.storage.from_(BUCKET_NAME).upload(
              path=filename_ru, file=f, file_options={"upsert": "true"}
          )
        updates["audio_ru_url"] = supabase.storage.from_(
            BUCKET_NAME
        ).get_public_url(filename_ru)
        print(f"✅ Загружено RU: {word_ru}")
      except Exception as e:
        print(f"❌ Ошибка RU для {word_ru}: {e}")

    if updates:
      supabase.table("words_dictation").update(updates).eq(
          "id", word_id
      ).execute()
      print(f"🔄 База обновлена для слова: {word_en}\n")

  print("🎉 Синхронизация завершена!")


if __name__ == "__main__":
  asyncio.run(generate_and_upload())
