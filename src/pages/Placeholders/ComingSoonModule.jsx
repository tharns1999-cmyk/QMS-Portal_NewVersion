import React from 'react';
import { useNavigate } from 'react-router-dom';

const ComingSoonModule = ({ moduleName, description }) => {
  const navigate = useNavigate();

  return (
    <div className="p-8 max-w-4xl mx-auto text-center h-[70vh] flex flex-col items-center justify-center">
      <div className="bg-white p-12 rounded-2xl border border-zinc-200 shadow-sm">
        <h1 className="text-3xl font-bold text-zinc-900 mb-4">{moduleName}</h1>
        <div className="inline-block px-3 py-1 mb-6 text-sm font-semibold text-blue-800 bg-blue-100 rounded-full">
          Coming Soon
        </div>
        <p className="text-zinc-600 mb-8 max-w-md mx-auto">
          {description || `The ${moduleName} module is currently under development. Please check back later.`}
        </p>
        <button
          onClick={() => navigate('/portal')}
          className="px-6 py-2.5 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition-colors"
        >
          Back to Portal
        </button>
      </div>
    </div>
  );
};

export default ComingSoonModule;
