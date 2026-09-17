await axios.post(`${API_URL}/sendMessage`, {
  chat_id: chatId,
  text: "سال را انتخاب کنید:",
  reply_markup: {
    inline_keyboard: [
      [
        { text: "1405", callback_data: "year_1405" },
        { text: "1406", callback_data: "year_1406" },
        { text: "1407", callback_data: "year_1407" }
      ]
    ]
  }
});
