import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { userInstruction, agentPrompt } = await req.json()

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: agentPrompt + '\n\nYou are a trading agent. Respond in 2-3 sentences of plain English explaining what you will do and why.',
        messages: [{
          role: 'user',
          content: `User instruction: ${userInstruction}\n\nContext: BTC $43,820 RSI 54 MACD bullish. ETH $3,210 RSI 71. Portfolio: BTC 22%, ETH 18%, cash 60%.`
        }]
      })
    })

    const data = await response.json()
    console.log('API response:', JSON.stringify(data))
    
    if (data.error) {
      return NextResponse.json({ response: 'API error: ' + data.error.message })
    }
    
    const text = data.content[0].text
    return NextResponse.json({ response: text })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ response: 'Error: ' + error.message }, { status: 500 })
  }
}