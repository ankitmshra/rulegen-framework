import React from 'react';

const SpamHamStats = ({ emailFiles }) => {
  if (!emailFiles || emailFiles.length === 0) {
    return null;
  }

  const spamCount = emailFiles.filter(file => file.email_type === 'spam').length;
  const hamCount = emailFiles.filter(file => file.email_type === 'ham').length;
  const totalCount = emailFiles.length;
  
  const spamPercentage = totalCount > 0 ? Math.round((spamCount / totalCount) * 100) : 0;
  const hamPercentage = totalCount > 0 ? Math.round((hamCount / totalCount) * 100) : 0;

  return (
    <div className="bg-white p-4 shadow rounded-lg mb-6">
      <h3 className="text-lg font-medium text-gray-900 mb-3">Email Classification Statistics</h3>
      
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-2"></span>
          <span className="text-sm font-medium">Spam: {spamCount} ({spamPercentage}%)</span>
        </div>
        <div className="flex items-center">
          <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>
          <span className="text-sm font-medium">Ham: {hamCount} ({hamPercentage}%)</span>
        </div>
      </div>
      
      {/* Progress bar visualization */}
      <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-red-500 float-left" 
          style={{ width: `${spamPercentage}%` }}
        ></div>
        <div 
          className="h-full bg-green-500 float-left" 
          style={{ width: `${hamPercentage}%` }}
        ></div>
      </div>
      
      {/* Guidance message */}
      <div className="mt-3 text-sm text-gray-600">
        {totalCount === 0 ? (
          <p>Upload both spam and ham emails for better rule generation.</p>
        ) : hamCount === 0 ? (
          <p className="text-orange-600">
            <span className="font-medium">Recommendation:</span> Include some ham (legitimate) emails 
            to help the system generate more accurate rules with fewer false positives.
          </p>
        ) : spamCount === 0 ? (
          <p className="text-orange-600">
            <span className="font-medium">Recommendation:</span> Include some spam emails 
            to help the system generate detection rules.
          </p>
        ) : hamCount < spamCount / 3 ? (
          <p className="text-yellow-600">
            <span className="font-medium">Tip:</span> Consider adding more ham examples for better results.
          </p>
        ) : (
          <p className="text-green-600">
            <span className="font-medium">Good balance:</span> Having both spam and ham examples will help create 
            rules that catch spam while avoiding false positives.
          </p>
        )}
      </div>
    </div>
  );
};

export default SpamHamStats;
