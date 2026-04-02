'use client'
import { useState } from 'react'

export default function RiskSettings() {
  const [agg, setAgg] = useState(3)
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="text-sm font-medium mb-4">Risk parameters</div>
        {[['Max risk per trade','2%'],['Max total drawdown','10%'],['Max portfolio exposure','70%'],['Max single asset','25%'],['Take-profit ratio','1:3 RR'],['Trading hours','24/7']].map(([l,v])=>(
          <div key={l} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
            <span className="text-sm text-gray-600">{l}</span>
            <input defaultValue={v} className="text-sm font-medium text-right w-24 border border-gray-200 rounded-lg px-2 py-1 bg-gray-50 focus:outline-none focus:border-emerald-400"/>
          </div>
        ))}
        <button className="w-full mt-4 bg-emerald-500 text-white text-sm font-medium py-2 rounded-lg">Save settings</button>
      </div>
      <div className="flex flex-col gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-sm font-medium mb-3">Agent behaviour</div>
          <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
            <span className="text-sm text-gray-600">Aggressiveness</span>
            <div className="flex items-center gap-2">
              <input type="range" min={1} max={5} value={agg} step={1}
                onChange={e=>setAgg(Number(e.target.value))} className="w-20"/>
              <span className="text-sm font-medium w-4 text-right">{agg}</span>
            </div>
          </div>
          {[['Learn from losses',true],['Auto-reduce on drawdown',true],['Pause if -5% in 1 day',true]].map(([l,on])=>(
            <div key={l} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-600">{l}</span>
              <div className={`w-8 h-4 rounded-full relative cursor-pointer ${on?'bg-emerald-500':'bg-gray-200'}`}>
                <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 ${on?'right-0.5':'left-0.5'}`}/>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-sm font-medium mb-3">Notifications</div>
          {[['Trade executed',true],['Stop-loss triggered',true],['Daily summary',true],['Drawdown alert',false]].map(([l,on])=>(
            <div key={l} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-600">{l}</span>
              <div className={`w-8 h-4 rounded-full relative cursor-pointer ${on?'bg-emerald-500':'bg-gray-200'}`}>
                <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 ${on?'right-0.5':'left-0.5'}`}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}