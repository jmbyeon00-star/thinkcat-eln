import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

const radarData = [
  { model: "m-BERT", accuracy: 51.1 },
  { model: "KorPatBERT", accuracy: 56.1 },
  { model: "IP-Force", accuracy: 70.0 },
];

export default function ModelAccuracyRadarChart() {
  return (
    <section className="max-w-4xl mx-auto bg-white p-8 rounded-xl border border-zinc-200 shadow-sm mt-10">
      <h2 className="text-xl font-semibold text-zinc-900 mb-6 border-b border-zinc-200 pb-3">
        CPC 분류 모델 성능 비교 (3,000건 기준)
      </h2>

      <div className="w-full h-96">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="model" />
            <PolarRadiusAxis angle={90} domain={[0, 100]} />
            <Radar
              name="정확도"
              dataKey="accuracy"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.5}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
