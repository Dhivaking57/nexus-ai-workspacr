module.exports = async function handler(req, res) {
  // 1. Allow POST requests only
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  // 2. Read the API key securely from Vercel
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing.");

    return res.status(500).json({
      error: "AI service is not configured."
    });
  }

  // 3. Validate the user's message
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

  // 4. Gemini request with automatic retries
  try {
    let response;
    let data;

    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            system_instruction: {
              parts: [
                {
                  text:
                    "You are Nexus AI, a helpful productivity assistant. " +
                    "Help users plan their work, organize ideas, and break " +
                    "goals into practical steps. Be clear and concise. " +
                    "Never claim you changed tasks or data unless an action " +
                    "actually performed that change."
                }
              ]
            },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: message.trim()
                  }
                ]
              }
            ],
            generationConfig: {
              maxOutputTokens: 600,
              temperature: 0.7
            }
          })
        }
      );

      data = await response.json();

      // Successful response: stop retrying
      if (response.ok) {
        break;
      }

      // Retry only temporary errors
      const retryableStatuses = [
        429, 500, 502, 503, 504
      ];

      const shouldRetry =
        retryableStatuses.includes(response.status) &&
        attempt < maxAttempts - 1;

      if (!shouldRetry) {
        console.error(
          "Gemini API request failed:",
          response.status,
          data.error?.message || "Unknown API error"
        );

        return res.status(502).json({
          error:
            response.status === 503
              ? "Gemini is busy right now. Please try again shortly."
              : response.status === 429
              ? "AI request limit reached. Please try again later."
              : "The AI service could not complete your request."
        });
      }

      // Wait 1.5 seconds, then 3 seconds before retrying
      const delay = 1500 * (attempt + 1);

      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // 5. Extract Gemini's reply
    const reply = (
      data.candidates?.[0]?.content?.parts || []
    )
      .map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      console.error(
        "Gemini returned no text.",
        data.promptFeedback || "No additional details"
      );

      return res.status(502).json({
        error: "The AI returned an empty response. Please try again."
      });
    }

    // 6. Send the reply to the website
    return res.status(200).json({
      reply: reply
    });

  } catch (error) {
    // 7. Handle network or unexpected errors
    console.error(
      "Nexus AI request failed:",
      error.message
    );

    return res.status(500).json({
      error: "Something went wrong. Please try again."
    });
  }
};
