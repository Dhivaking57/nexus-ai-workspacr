
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "AI service is not configured."
    });
  }

  const message = req.body?.message;

  if (
    typeof message !== "string" ||
    !message.trim() ||
    message.length > 2000
  ) {
    return res.status(400).json({
      error: "Enter a message of up to 2000 characters."
    });
  }

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{
              text:
                "You are Nexus AI, a helpful productivity assistant. " +
                "Help users plan their work, organize ideas, and break " +
                "goals into practical steps. Be clear and concise. " +
                "Never claim you changed tasks or data unless an action " +
                "actually performed that change."
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: message.trim() }]
          }],
          generationConfig: {
            maxOutputTokens: 600,
            temperature: 0.7
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API request failed:",response.status, data.error || data);
      return res.status(502).json({
        error: "The AI service could not complete your request."
      });
    }

    const reply = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: "The AI returned an empty response. Please try again."
      });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("Nexus AI request failed:", error.message);

    return res.status(500).json({
      error: "Something went wrong. Please try again."
    });
  }
};
