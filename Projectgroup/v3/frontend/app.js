document.getElementById("submitButton").addEventListener("click", function() {
    const userText = document.getElementById("userText").value;
    const audioInput = document.getElementById("audioInput").files[0];

    let formData = new FormData();
    formData.append("text", userText);
    formData.append("audio", audioInput);

    fetch("http://localhost:5000/recommend", {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        let recommendations = "<h2>Recommendations:</h2>";
        data.forEach(item => {
            recommendations += `<p>${item.title} - ${item.emotion_target} (Score: ${item.score})</p>`;
        });
        document.getElementById("recommendations").innerHTML = recommendations;
    })
    .catch(error => console.error('Error:', error));
});
