import axios from 'axios'

export async function sendHelloWorld(to, otp) {
    let formatted = to
    if (!formatted.startsWith('+91')) {
        formatted = `+91${formatted}`
    }

    const response = await axios({
        url: `https://graph.facebook.com/v20.0/${process.env.WA_PHONE_ID}/messages`,
        method: 'post',
        headers: {
            'Authorization': `Bearer ${process.env.WA_TOKEN}`,
            'Content-Type': 'application/json'
        },
        data: JSON.stringify({
            messaging_product: 'whatsapp',
            to: formatted, // number coming from UI
            type: 'template',
            template: {
                name: 'discount',
                language: {
                    code: 'en'
                },
                components: [
                    {
                        type: 'body',
                        parameters: [
                            {
                                type: 'text',
                                text: otp
                            }
                        ]
                    }
                ]
            }
        })
    })
    return response.data
}
