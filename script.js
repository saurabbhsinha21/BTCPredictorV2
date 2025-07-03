let model;

async function loadModel() {
  try {
    model = await tf.loadLayersModel(
      "https://saurabbhsinha21.github.io/BTCPredictorV2/tfjs_model/model.json"
    );
    console.log("✅ Model loaded.");
  } catch (e) {
    alert("❌ Model not loaded");
    console.error(e);
  }
}

loadModel();

document.getElementById("predictForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!model) return alert("Model not loaded");

  // Fetch last 30 prices and normalize similarly to training
  const resp = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=30");
  const candles = await resp.json();
  const closes = candles.map(d => parseFloat(d[4]));
  const min = Math.min(...closes), max = Math.max(...closes);
  const norm = closes.map(p => (p - min) / (max - min));

  const input = tf.tensor(norm).reshape([1, 30, 1]);
  const pred = model.predict(input);
  const yPred = (await pred.data())[0] * (max - min) + min;

  document.getElementById("result").innerHTML =
    `Predicted Price: ${yPred.toFixed(2)} USDT`;
});
