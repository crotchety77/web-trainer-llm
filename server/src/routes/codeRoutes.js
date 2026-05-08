import { Router } from "express";
import axios from "axios";
import { executeCodeOnPiston } from "../modules/pistonExecutor.js";

const router = Router();

router.post("/run", async (req, res) => {
  const { language, code } = req.body;

  if (!language || !code) {
    return res.status(400).json({ error: "Language and code are required." });
  }

  try {
    const response = await axios.post("http://127.0.0.1:2000/api/v2/execute", {
      language: language,
      version: "*",
      files: [{ content: code }]
    });

    res.json(response.data.run);
  } catch (error) {
    console.error("Code execution error:", error.response?.data || error.message);
    res.status(500).json({ error: "Ошибка выполнения кода" });
  }
});

router.post("/run-tests", async (req, res) => {
  const { language, code, test_cases, function_name } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Code is required." });
  }

  try {
    const executionResult = await executeCodeOnPiston(
      code,
      language,
      test_cases || [],
      function_name
    );
    res.json(executionResult);
  } catch (error) {
    console.error("Test execution error:", error.message);
    res.status(500).json({ error: "Ошибка выполнения тестов" });
  }
});

export default router;
