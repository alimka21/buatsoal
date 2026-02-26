import { useGeneratorStore } from '@/store/generatorStore';
import { useAuthStore } from '@/store/authStore';
import GeneratorForm from './GeneratorForm';
import ResultViewer from './ResultViewer';
import { useFirstLogin } from '@/hooks/useFirstLogin';
import { useState } from 'react';
import Swal from 'sweetalert2';

export default function Generator() {
  useFirstLogin();
  const { session } = useAuthStore();
  const { isGenerating, result, error, cacheHit, addToCart, formData, setFormData } = useGeneratorStore();

  const handleAddToCart = (data: any) => {
    if (session?.user.id) {
      addToCart(data);
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Sesi Habis',
        text: 'Silakan login kembali untuk melanjutkan.',
        confirmButtonColor: '#2563eb'
      });
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Sidebar Form */}
      <div className="w-[400px] xl:w-[450px] flex-none z-20 h-full border-r border-slate-200 bg-white">
        <GeneratorForm 
          onSubmit={handleAddToCart} 
          isLoading={isGenerating} 
          onValuesChange={setFormData}
        />
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 min-w-0 h-full bg-slate-50">
        <ResultViewer 
          result={result} 
          cached={cacheHit} 
          isLoading={isGenerating} 
          error={error} 
          formData={formData}
        />
      </div>
    </div>
  );
}
