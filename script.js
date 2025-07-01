let model;

async function loadModel() {
  try {
    model = await tf.loadLayersModel("tfjs_model/model.json");
    console.log("✅ Model loaded.");
  } catch (error) {
    console.error("❌ Model loading failed:", error);
  }
}

// This fetches 30 1m candle closes from Binance
async function getNormalizedPrices() {
  const res = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=30");
  const data = await res.json();
  const closes = data.map(d => parseFloat(d[4]));

  // Normalize
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
    alert("Model not loaded");
    return;
  }

  const { normalized, min, max } = await getNormalizedPrices();
  if (normalized.length < 30) {
    alert("Not enough price data");
    return;
  }

  const input = tf.tensor3d([normalized], [1, 30, 1]);
  const output = model.predict(input);
  const prediction = (await output.data())[0];
  const predictedPrice = prediction * (max - min) + min;

  const result = predictedPrice >= targetPrice ? "Yes ✅" : "No ❌";

  document.getElementById("result").innerHTML = `
    <p><b>Predicted Price:</b> ${predictedPrice.toFixed(2)} USDT</p>
    <p><b>Prediction:</b> ${result}</p>
  `;
});

loadModel();
