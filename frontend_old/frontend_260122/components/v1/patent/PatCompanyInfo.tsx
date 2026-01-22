import { Building2, Calendar, Users, Briefcase } from "lucide-react";

type CompanyData = {
    name: string;
    estb_dt: string;
    em_cnt: number;
    bzc_nm: string;
    age?: string;
};

type CompanyInfoProps = {
    company: CompanyData;
}

export default function CompanyInfo({ company }: CompanyInfoProps) {
    return (
       <div className="bg-white rounded-xl shadow-lg border border-zinc-200 overflow-hidden mb-8">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Building2 size={24} />
                    기업 정보
                </h2>
            </div>

            <div className="p-6">
                <h3 className="text-2xl font-bold text-zinc-900 mb-6">
                    {company.name || "정보 없음"}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <Calendar size={20} className="text-blue-600 mt-1 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-zinc-600 mb-1">설립일</p>
                            <p className="text-sm font-semibold text-zinc-900">
                                {company.estb_dt || "정보 없음"}
                            </p>
                            {company.age && (
                                <p className="text-xs text-zinc-500 mt-1">
                                    설립 {company.age}년차
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-100">
                        <Users size={20} className="text-green-600 mt-1 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-zinc-600 mb-1">직원 수</p>
                            <p className="text-sm font-semibold text-zinc-900">
                                {company.em_cnt ? `${company.em_cnt.toLocaleString()}명` : "정보 없음"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg border border-purple-100">
                        <Briefcase size={20} className="text-purple-600 mt-1 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-zinc-600 mb-1">업종</p>
                            <p className="text-sm font-semibold text-zinc-900">
                                {company.bzc_nm || "정보 없음"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
