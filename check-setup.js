#!/usr/bin/env node

/**
 * Intent Writer - Setup Checker
 * 检查项目配置是否完整
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 Intent Writer Setup Checker\n');
console.log('=' .repeat(50));

let allGood = true;

// 1. 检查 .env.local 文件
console.log('\n1️⃣  Checking .env.local file...');
const envPath = path.join(__dirname, '.env.local');

if (!fs.existsSync(envPath)) {
  console.log('   ❌ .env.local file not found');
  console.log('   💡 Run: cp .env.local.example .env.local');
  allGood = false;
} else {
  console.log('   ✅ .env.local file exists');

  // 读取环境变量
  const envContent = fs.readFileSync(envPath, 'utf-8');

  // 检查必需的环境变量
  const requiredVars = [
    'NEXT_PUBLIC_PARTYKIT_HOST',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];

  console.log('\n2️⃣  Checking environment variables...');
  requiredVars.forEach(varName => {
    const regex = new RegExp(`${varName}=(.+)`);
    const match = envContent.match(regex);

    if (!match || !match[1] || match[1].trim() === '') {
      console.log(`   ❌ ${varName} is not set`);
      allGood = false;
    } else if (match[1].includes('xxxxx') || match[1].includes('your-')) {
      console.log(`   ⚠️  ${varName} contains placeholder value`);
      allGood = false;
    } else {
      console.log(`   ✅ ${varName} is configured`);
    }
  });
}

// 3. 检查 node_modules
console.log('\n3️⃣  Checking dependencies...');
const nodeModulesPath = path.join(__dirname, 'node_modules');

if (!fs.existsSync(nodeModulesPath)) {
  console.log('   ❌ node_modules not found');
  console.log('   💡 Run: npm install');
  allGood = false;
} else {
  console.log('   ✅ Dependencies installed');

  // 检查关键依赖
  const criticalDeps = [
    'partykit',
    'partysocket',
    'y-partykit',
    'yjs',
    '@supabase/supabase-js',
    'next',
    'react'
  ];

  let missingDeps = [];
  criticalDeps.forEach(dep => {
    const depPath = path.join(nodeModulesPath, dep);
    if (!fs.existsSync(depPath)) {
      missingDeps.push(dep);
    }
  });

  if (missingDeps.length > 0) {
    console.log(`   ⚠️  Missing dependencies: ${missingDeps.join(', ')}`);
    console.log('   💡 Run: npm install');
    allGood = false;
  }
}

// 4. 检查关键文件
console.log('\n4️⃣  Checking project files...');
const criticalFiles = [
  'app/page.tsx',
  'app/layout.tsx',
  'app/dashboard/page.tsx',
  'app/room/[id]/page.tsx',
  'components/CollaborativeEditor.tsx',
  'components/WritingEditor.tsx',
  'components/IntentPanel.tsx',
  'party/server.ts',
  'partykit.json',
  'middleware.ts'
];

criticalFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} not found`);
    allGood = false;
  }
});

// 总结
console.log('\n' + '='.repeat(50));
if (allGood) {
  console.log('\n✅ All checks passed! Your setup looks good.');
  console.log('\n📝 Next steps:');
  console.log('   1. Make sure you\'ve run the SQL schema in Supabase');
  console.log('      (Copy contents of supabase/schema.sql to Supabase SQL Editor)');
  console.log('   2. Run: npm run dev');
  console.log('   3. Open: http://localhost:3000');
  console.log('\n📖 For detailed instructions, see QUICKSTART.md\n');
} else {
  console.log('\n❌ Some issues found. Please fix them before proceeding.');
  console.log('\n📖 See QUICKSTART.md for detailed setup instructions.\n');
  process.exit(1);
}
