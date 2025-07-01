let model;

// Load the trained LSTM model from tfjs_model folder
async function loadModel() {
  try {
    model = await tf.loadLayersModel("tfjs_model/model.json");
    console.log("✅ Model loaded.");
  } catch (error) {
    console.error("❌ Failed to load model:", error);
  }
}

// Dummy function – replace this with actual price fetching logic
async function getLast30Prices() {
  // Fetch historical data from Binance (past 30 minutes)
  const res = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=30");
  const data = await res.json();
  const closes = data.map(d => parseFloat(d[4]));

  // Normalize using min-max between 0 and 1 (as model was trained)
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const normalized = closes.map(p => (p - min) / (max - min));

  return { normalized, min, max };
}

document.getElementById("predictForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const targetPrice = parseFloat(document.getElementById("targetPrice").value);
  const targetTime = new Date(document.getElementById("targetTime").value);

  if (!model) {
    document.getElementById("result").innerText = "❌ Model not loaded.";
    return;
  }

  // Step 1: Get normalized data
  const { normalized, min, max } = await getLast30Prices();
  if (normalized.length < 30) {
    document.getElementById("result").innerText = "Not enough data to predict.";
    return;
  }

  // Step 2: Predict using the ML model
  const inputTensor = tf.tensor3d([normalized], [1, 30, 1]);
  const predictionTensor = model.predict(inputTensor);
  const predictedNormalized = (await predictionTensor.data())[0];
  const predictedPrice = predictedNormalized * (max - min) + min;

  const decision = predictedPrice >= targetPrice ? "Yes ✅" : "No ❌";

  // Step 3: Display result
  document.getElementById("result").innerHTML = `
    <p><b>Predicted Price:</b> ${predictedPrice.toFixed(2)} USDT</p>
    <p><b>Target:</b> ${targetPrice.toFixed(2)} by ${targetTime.toLocaleTimeString()}</p>
    <p><b>Prediction:</b> ${decision}</p>
  `;
});

// Load model when page loads
loadModel();
