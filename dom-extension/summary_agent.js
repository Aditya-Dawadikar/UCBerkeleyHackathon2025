async function fetch_page_summary(page_text) {

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyBV3uUh9KkOdupuyPTM9iOdITJK601utmM";

    const prompt = `You are my memory assistant. Summarize the following web page in a way that helps me recall it later accurately.

        Do:
        - Extract factual details like names, numbers, steps, and definitions exactly as they appear
        - Include important links (URLs) along with a short description of what they point to
        - Capture key points, structure, or purpose of the content
        - Reflect the tone or author’s intent if clear

        Don't:
        - Add any made-up facts or assumptions
        - Paraphrase critical facts — quote them if needed
        - Omit links that the user may want to revisit

        Format:
        - Title (if available)
        - Summary in bullet points
        - Key links (as [label](url) or raw URLs with context)

        Here is the full page text: My name is hello world
    `;

    var postData = {
        contents: [
            { parts: [{ text: prompt + page_text.slice(0, 12000) }] }
        ]
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json' // Indicate that the request body is JSON
            },
            body: JSON.stringify(postData)
        }
        );
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        const json = await response.json();
        console.log(json);
        var summary_text = json.candidates[0].content.parts[0].text;
        console.log(summary_text);

        // Send to vectorize API
        fetch('http://34.70.128.223:8000/vectorize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: summary_text
            })
        })
            .then(res => res.json())
            .then(data => {
                console.log('Vectorize API response:', data);
            })
            .catch(err => {
                console.error('Error sending to vectorize API:', err);
            });

        return summary_text;
    } catch (error) {
        console.error(error.message);
    }
}