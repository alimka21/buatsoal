import { useGeneratorStore } from '@/store/generatorStore';
import { useAuthStore } from '@/store/authStore';
import GeneratorForm from './GeneratorForm';
import ResultViewer from './ResultViewer';
import { useFirstLogin } from '@/hooks/useFirstLogin';
import { useState } from 'react';

export default function Generator() {
  useFirstLogin();
  const { session } = useAuthStore();
  const { loading, result, error, cacheHit, generate } = useGeneratorStore();
  const [formData, setFormData] = useState<any>(null);

  const handleGenerate = (data: any) => {
    if (session?.user.id) {
      generate(session.user.id, data);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Sidebar Form */}
      <div className="w-[400px] xl:w-[450px] flex-none z-20 h-full border-r border-slate-200 bg-white">
        <GeneratorForm 
          onSubmit={handleGenerate} 
          isLoading={loading} 
          onValuesChange={setFormData}
        />
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 min-w-0 h-full bg-slate-50">
        <ResultViewer 
          result={result} 
          cached={cacheHit} 
          isLoading={loading} 
          error={error} 
          formData={formData}
        />
      </div>
    </div>
  );
}
