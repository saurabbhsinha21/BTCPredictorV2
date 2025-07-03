let model;

async function loadModel() {
  try {
    model = await tf.loadLayersModel(
      "https://saurabbhsinha21.github.io/BTCPredictorV2/tfjs_model/model.json"
    );
    console.log("✅ Model loaded successfully");
  } catch (error) {
    alert("❌ Model not loaded");
    console.error(error);
  }
}

function preprocessData(data) {
  // Normalize and reshape to [1, 30, 1]
  const tensor = tf.tensor(data).reshape([1, 30, 1]);
  return tensor;
}

document.addEventListener("DOMContentLoaded", () => {
  loadModel();

  const form = document.getElementById("predictForm");
  const resultDiv = document.getElementById("result");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!model) {
      alert("❌ Model not loaded yet!");
      return;
    }

    // 🔧 For now, we use dummy data (replace with real BTC prices later)
    const dummyPrices = Array.from({ length: 30 }, () => Math.random());

    const input = preprocessData(dummyPrices);

    const prediction = model.predict(input);
    const output = await prediction.data();

    resultDiv.innerText = `Predicted price: ${output[0].toFixed(2)} USDT`;
  });
});
