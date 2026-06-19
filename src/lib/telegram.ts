// Helper para interactuar con la API de Telegram.

const API = (method: string) =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`

function configured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
}

type InlineButton = { text: string; callback_data: string }

export async function sendMessage(text: string, buttons?: InlineButton[][]) {
  if (!configured()) {
    console.warn('Telegram no configurado')
    return
  }
  try {
    await fetch(API('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
        ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
      }),
    })
  } catch (e) {
    console.error('Error enviando mensaje Telegram:', e)
  }
}

export async function answerCallback(callbackId: string, text?: string) {
  try {
    await fetch(API('answerCallbackQuery'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackId, text: text ?? '' }),
    })
  } catch (e) {
    console.error('Error answerCallbackQuery:', e)
  }
}

export async function editMessageText(chatId: number | string, messageId: number, text: string) {
  try {
    await fetch(API('editMessageText'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML' }),
    })
  } catch (e) {
    console.error('Error editMessageText:', e)
  }
}
