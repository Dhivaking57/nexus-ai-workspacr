
module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Gemini API key is not configured."
    });
  }

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models",
      {
        method: "GET",
        headers: {
          "x-goog-api-key": apiKey
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Model list failed:",
        response.status,
        data.error?.message
      );

      return res.status(502).json({
        error: "Could not retrieve available models."
      });
    }

    const models = (data.models || [])
      .filter(model =>
        (model.supportedGenerationMethods || [])
          .includes("generateContent")
      )
      .map(model => model.name);

    return res.status(200).json({
      count: models.length,
      models
    });

  } catch (error) {
    console.error("Model check failed:", error.message);

    return res.status(500).json({
      error: "Could not contact the Gemini API."
    });
  }
};
