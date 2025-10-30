import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Customized,
    LabelList,
    Legend,
  } from "recharts";
  
  const lineData = [
    { epoch: 1, mBERT: 0.0111, KorPatBERT: 0.0139, IPforce: 0.0277 },
    { epoch: 2, mBERT: 0.0139, KorPatBERT: 0.0333, IPforce: 0.0750 },
    { epoch: 3, mBERT: 0.0556, KorPatBERT: 0.0139, IPforce: 0.1388 },
    { epoch: 4, mBERT: 0.1083, KorPatBERT: 0.0222, IPforce: 0.2444 },
    { epoch: 5, mBERT: 0.1611, KorPatBERT: 0.0472, IPforce: 0.3666 },
    { epoch: 6, mBERT: 0.1917, KorPatBERT: 0.0472, IPforce: 0.4444 },
    { epoch: 7, mBERT: 0.2250, KorPatBERT: 0.0639, IPforce: 0.4861 },
    { epoch: 8, mBERT: 0.2611, KorPatBERT: 0.1111, IPforce: 0.5194 },
    { epoch: 9, mBERT: 0.3361, KorPatBERT: 0.1833, IPforce: 0.5416 },
    { epoch: 10, mBERT: 0.3389, KorPatBERT: 0.2806, IPforce: 0.5722 },
    { epoch: 11, mBERT: 0.3778, KorPatBERT: 0.3972, IPforce: 0.6000 },
    { epoch: 12, mBERT: 0.3944, KorPatBERT: 0.4722, IPforce: 0.6111 },
    { epoch: 13, mBERT: 0.3861, KorPatBERT: 0.5028, IPforce: 0.6250 },
    { epoch: 14, mBERT: 0.4139, KorPatBERT: 0.5111, IPforce: 0.6444 },
    { epoch: 15, mBERT: 0.4333, KorPatBERT: 0.5167, IPforce: 0.6583 },
    { epoch: 16, mBERT: 0.4611, KorPatBERT: 0.5056, IPforce: 0.6666 },
    { epoch: 17, mBERT: 0.4750, KorPatBERT: 0.5500, IPforce: 0.6694 },
    { epoch: 18, mBERT: 0.4639, KorPatBERT: 0.5444, IPforce: 0.6944 },
    { epoch: 19, mBERT: 0.4944, KorPatBERT: 0.5444, IPforce: 0.6944 },
    { epoch: 20, mBERT: 0.5111, KorPatBERT: 0.5611, IPforce: 0.7000 }
  ];

  type LineData = {
    epoch: number;
    KorPatBERT: number;
    IPforce: number;
    mBERT: number;
  };
  
  type CustomTooltipProps = {
    active?: boolean;
    payload?: {
      payload: LineData;
      name: string;
      value: number;
      color?: string;
    }[];
    label?: number;
  };
  
  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-zinc-200">
          <p className="text-sm font-semibold text-zinc-700 mb-2">Epoch {label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-zinc-600">{entry.name}:</span>
              <span className="font-semibold text-zinc-900">{entry.value.toFixed(4)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };
  const LastLabel = ({ x, y, value, index }: any) => {
      const isLast = index === lineData.length - 1;
      if (!isLast) return null;

      return (
        <text
          x={x}
          y={y - 12}
          fill="#475569"
          fontSize={11}
          fontWeight={600}
          textAnchor="middle"
        >
          {value.toFixed(4)}
        </text>
      );
    };

  export default function ModelAccuracyLineChart() {
    const finalmBERT = lineData[lineData.length - 1].mBERT;
    const finalKorPatBERT = lineData[lineData.length - 1].KorPatBERT;
    const finalIPforce = lineData[lineData.length - 1].IPforce;
  
    return (
      <div className="bg-white">
        <div className="w-full">  
          {/* Header */}
          <div className="mb-3">
            <h1 className="text-xl font-bold text-zinc-900 mb-1">
              모델 학습 성능 분석
            </h1>
            <p className="text-sm text-zinc-600">
              KorPatBERT와 IPforce 모델의 Epoch별 정확도 비교
            </p>
          </div>
  
          {/* Chart Card */}
          <div className="bg-white rounded-xl shadow-lg border border-zinc-100 overflow-hidden">
            {/* Card Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3">
              <h2 className="text-base font-semibold text-white mb-1">
                모델별 학습 추이
              </h2>
              <p className="text-blue-100 text-xs">
                Training Accuracy over Epochs
              </p>
            </div>
  
            {/* Chart */}
            <div className="p-4">
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">

                  <LineChart 
                    data={lineData} 
                    margin={{ top: 20, right: 20, left: 5, bottom: 10 }}
                  >
                <defs>
                   <linearGradient id="colorMBERT" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorKorPatBERT" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#faba60ff" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#faba60ff" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorIPforce" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1e40af" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#1e40af" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                    
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    
                    <XAxis 
                      dataKey="epoch"
                      tick={{ fill: '#52525b', fontSize: 11 }}
                      label={{ 
                        value: "Epoch", 
                        position: "insideBottom", 
                        offset: -5,
                        style: { fill: '#333', fontWeight: 600, fontSize: 12}
                      }}
                    />
                    
                    <YAxis 
                      domain={[0, 0.7]}
                      tick={{ fill: '#52525b', fontSize: 11 }}
                      label={{ 
                        value: "Accuracy", 
                        angle: -90, 
                        position: "insideLeft",
                        style: { fill: '#333', fontWeight: 600, fontSize: 12 }
                      }}
                    />
                    
                    <Tooltip content={<CustomTooltip />} />
                    
                    <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} iconType="line" />

                    <Line
                    type="monotone"
                    dataKey="mBERT"
                    stroke="#94a3b8"
                    strokeWidth={2.5}
                    dot={{ 
                      fill: '#94a3b8', 
                      stroke: '#fff',
                      strokeWidth: 1.5,
                      r: 4
                    }}
                    activeDot={{ r: 6 }}
                  >
                  <LabelList content={<LastLabel />} />



                  </Line>
                    <Line
                      type="monotone"
                      dataKey="KorPatBERT"
                      stroke="#faba60ff"
                      strokeWidth={2.5}
                      dot={{ 
                        fill: '#faba60ff', 
                        stroke: '#fff',
                        strokeWidth: 1.5,
                        r: 4
                      }}
                      activeDot={{ r: 6 }}
                    >
                    <LabelList content={<LastLabel />} />
                    </Line>

                    <Line
                      type="monotone"
                      dataKey="IPforce"
                      stroke="#1e40af"
                      strokeWidth={2.5}
                      dot={{ 
                        fill: '#1e40af',
                        stroke: '#fff',
                        strokeWidth: 1.5,
                        r: 4
                      }}
                      activeDot={{ r: 6 }}
                    >
                    <LabelList content={<LastLabel />} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
  
            {/* Footer Note */}
            <div className="px-4 py-2 bg-zinc-50 border-t border-zinc-100">
              <p className="text-xs text-zinc-500">
                💡 IPforce 모델이 Epoch 20에서 최고 정확도 0.70를 달성했습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }