import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    TooltipProps,
    ResponsiveContainer,
    LabelList,
    Cell,
} from "recharts";
  
const barData = [
    { model: "m-BERT", accuracy: 30.2, color: "#94a3b8" },
    { model: "KorPatBERT", accuracy: 50.5, color: "#60a5fa" },
    { model: "IP-Force", accuracy: 69.4, color: "#10b981" },
];
type BarData = {
    model: string;
    accuracy: number;
    color: string;
};
  
type CustomTooltipProps = {
    active?: boolean;
    payload?: { payload: BarData }[];
  };

    const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
        if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-zinc-200">
            <p className="text-sm font-semibold text-zinc-700 mb-2">{data.model}</p>
            <div className="flex items-center gap-2 text-sm">
                <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: data.color }}
                />
                <span className="text-zinc-600">정확도:</span>
                <span className="font-semibold text-zinc-900">{data.accuracy}%</span>
            </div>
            </div>
        );
        }
        return null;
    };
  
  export default function ModelAccuracyBarChart() {
    const maxAccuracy = Math.max(...barData.map(d => d.accuracy));
    const baselineModel = barData[0];
    const bestModel = barData[barData.length - 1];
    const improvement = ((bestModel.accuracy - baselineModel.accuracy) / baselineModel.accuracy * 100).toFixed(1);
    
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-zinc-900 mb-2">
              모델 성능 비교 분석
            </h1>
            <p className="text-zinc-600">
              한국 특허 CPC 분류 정확도 벤치마크
            </p>
          </div>
  
          {/* Chart Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
            {/* Card Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
              <h2 className="text-xl font-semibold text-white mb-2">
                CPC 서브클래스 분류 성능
              </h2>
              <p className="text-blue-100 text-sm">
                3,000개 한국 특허 데이터 / 90종 CPC 서브클래스
              </p>
            </div>
  
            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-6 px-8 py-6 bg-zinc-50 border-b border-zinc-100">
              {barData.map((item, idx) => (
                <div 
                  key={item.model}
                  className="bg-white rounded-xl p-4 shadow-sm border"
                  style={{ borderColor: item.color + '40' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-medium text-zinc-700">{item.model}</span>
                    {item.accuracy === maxAccuracy && (
                      <span className="ml-auto text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-semibold">
                        Best
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-zinc-900">
                    {item.accuracy}%
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">분류 정확도</div>
                </div>
              ))}
            </div>
  
            {/* Chart */}
            <div className="p-8">
              <div className="w-full h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={barData} 
                    margin={{ top: 30, right: 30, left: 10, bottom: 20 }}
                  >
                    <defs>
                      {barData.map((entry, index) => (
                        <linearGradient key={index} id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={entry.color} stopOpacity={0.9}/>
                          <stop offset="100%" stopColor={entry.color} stopOpacity={0.6}/>
                        </linearGradient>
                      ))}
                    </defs>
                    
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    
                    <XAxis 
                      dataKey="model"
                      tick={{ fill: '#52525b', fontSize: 12 }}
                      axisLine={{ stroke: '#d4d4d8' }}
                    />
                    
                    <YAxis 
                      domain={[0, 100]}
                      tick={{ fill: '#52525b', fontSize: 12 }}
                      label={{ 
                        value: "정확도 (%)", 
                        angle: -90, 
                        position: "insideLeft",
                        style: { fill: '#3f3f46', fontWeight: 600 }
                      }}
                    />
                    
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                    
                    <Bar 
                      dataKey="accuracy" 
                      radius={[8, 8, 0, 0]}
                      maxBarSize={100}
                    >
                      {barData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={`url(#gradient-${index})`}
                        />
                      ))}
                      <LabelList 
                        dataKey="accuracy" 
                        position="top"
                        offset={12}
                        formatter={(v) => `${v}%`}
                        style={{ 
                          fontSize: '14px', 
                          fontWeight: 700,
                          fill: '#18181b'
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
  
            {/* Footer Note */}
            <div className="px-8 py-4 bg-zinc-50 border-t border-zinc-100">
              <p className="text-xs text-zinc-500">
                💡 IP-Force 모델이 m-BERT 대비 {improvement}% 향상된 성능을 달성했습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }