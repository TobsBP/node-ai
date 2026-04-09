import dotenv from 'dotenv'

dotenv.config()

const gemini_key = process.env.GEMINI_API_KEY;

console.log(gemini_key)