#!/usr/bin/env node
/**
 * 灾厄之后·重制版 - YAML to JS 数据转换脚本（v2 扁平格式）
 *
 * 功能：
 * 1. 遍历 data-source/世界书/ 全部 YAML/TXT，生成三个 JS 数据模块（直写根目录 module/）：
 *    - prompt-data-core-calamity.js  扁平格式 export const promptData = { '分类/条目名': 正文 }
 *    - prompt-data-npc-calamity.js   嵌套格式 calamityPrompts.NPC（兼容兜底）
 *    - prompt-data-world-calamity.js 嵌套格式 calamityPrompts（其余分类，兼容兜底）
 * 2. 剥离成对的 XML 式包装标签（<Xxx> ... </Xxx>，ST 式条目类型标记，不入 Prompt）
 * 3. 数据质量检查 + 生成报告
 *
 * key 规则：key = '最深目录名/文件名（去扩展名）'
 *   世界书/装备/武器/铁剑.yaml → '武器/铁剑'
 *   世界书/地理/势力/圣火骑士团.yaml → '势力/圣火骑士团'
 *   世界书/地理/区域·北方山脉.yaml → '地理/区域·北方山脉'
 *
 * 使用：
 * node tools/convert-yaml-to-js.js   （或项目根目录 npm run convert）
 */

const fs = require('fs');
const path = require('path');

// ==================== 配置 ====================
const CONFIG = {
  inputDir: path.join(__dirname, '..', '世界书'),
  outputDir: path.join(__dirname, '..', '..', 'module'),   // 直写运行时模块目录
  reportDir: path.join(__dirname, '..', 'reports'),

  outputs: {
    core: 'prompt-data-core-calamity.js',      // 扁平：全部分类（运行时主数据源）
    npc: 'prompt-data-npc-calamity.js',        // 嵌套：NPC（兜底）
    world: 'prompt-data-world-calamity.js',    // 嵌套：其余分类（兜底）
    report: 'data-quality-report.md'
  },

  // 输出排序用固定分类顺序（未列出的分类追加在末尾）
  categoryOrder: ['NPC', '世界观', '势力', '地理', '种族', '生物', '装备', '武器', '护甲', '检定', '扮演准则', '时间线', '系统']
};

// 剥离成对的 XML 式包装标签（首行 <Xxx> / 末行 </Xxx>），并去除首尾空行
function stripWrapperTags(content) {
  let lines = content.replace(/\r\n/g, '\n').split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (!lines.length) return '';
  if (/^<[\w\u4e00-\u9fa5·-]+>$/.test(lines[0])) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (lines.length && /^<\/[\w\u4e00-\u9fa5·-]+>$/.test(lines[lines.length - 1])) lines.pop();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.join('\n');
}

// ==================== 数据质量检查器 ====================
class DataQualityChecker {
  constructor() {
    this.issues = {
      critical: [],   // 严重问题（缺失必填字段）
      warning: [],    // 警告（内容过短、格式不一致）
      suggestion: []  // 建议（可优化点）
    };
    this.stats = {
      totalFiles: 0,
      processedFiles: 0,
      emptyFields: 0,
      shortContent: 0,
      missingRequired: 0
    };
  }

  // 检查 NPC 数据完整性
  checkNPC(filename, data) {
    const content = this._extractText(data);

    // 对于 Markdown 格式，检查是否包含必要的章节标题
    const required = ['基础信息', '外貌', '性格', '背景'];
    const recommended = ['能力', '跑团接口', '战斗值', '六维'];

    // 检查必要章节
    for (const section of required) {
      if (!content.includes(section)) {
        this.issues.warning.push({
          file: filename,
          field: section,
          issue: '可能缺失推荐章节',
          severity: 'warning'
        });
      }
    }

    // 检查内容长度
    if (content.length < 500) {
      this.issues.warning.push({
        file: filename,
        issue: `内容较短（${content.length} 字），建议补充详细描述`,
        severity: 'warning'
      });
      this.stats.shortContent++;
    } else if (content.length < 200) {
      this.issues.critical.push({
        file: filename,
        issue: `内容过短（${content.length} 字），需要补充`,
        severity: 'critical'
      });
      this.stats.missingRequired++;
    }

    // 检查战斗数值
    if (!content.includes('HP') && !content.includes('生命值') && !content.includes('战斗值')) {
      this.issues.warning.push({
        file: filename,
        field: '战斗数值',
        issue: '缺少 HP/战斗值信息',
        severity: 'warning'
      });
    }

    if (!content.includes('六维') && !content.includes('力量') && !content.includes('敏捷')) {
      this.issues.warning.push({
        file: filename,
        field: '六维属性',
        issue: '缺少六维属性信息',
        severity: 'warning'
      });
    }
  }

  // 检查系统规则数据
  checkSystem(filename, data) {
    const content = this._extractText(data);

    if (content.length < 50) {
      this.issues.warning.push({
        file: filename,
        issue: `内容过短（${content.length} 字）`,
        severity: 'warning'
      });
      this.stats.shortContent++;
    }

    // 检查是否有示例
    if (filename.includes('检定') || filename.includes('战斗') || filename.includes('锻造')) {
      if (!content.includes('示例') && !content.includes('例：') && !content.includes('例子')) {
        this.issues.suggestion.push({
          file: filename,
          issue: '建议添加示例说明',
          severity: 'suggestion'
        });
      }
    }
  }

  // 检查地理/势力数据
  checkWorld(filename, data) {
    if (filename.includes('区域') || filename.includes('势力')) {
      const requiredFields = ['基本信息', '特征'];
      for (const field of requiredFields) {
        if (!this._hasContent(data, field)) {
          this.issues.warning.push({
            file: filename,
            field: field,
            issue: '缺失推荐字段',
            severity: 'warning'
          });
        }
      }
    }
  }

  // 辅助函数：检查字段是否有内容
  _hasContent(data, field) {
    if (typeof data === 'string') return data.length > 0;
    if (typeof data === 'object' && data !== null) {
      const value = data[field];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'string') return value.trim().length > 0;
      if (typeof value === 'object' && value !== null) {
        return Object.keys(value).length > 0;
      }
      return value !== undefined && value !== null;
    }
    return false;
  }

  // 辅助函数：提取文本内容
  _extractText(data) {
    if (typeof data === 'string') return data;
    if (typeof data === 'object' && data !== null) {
      return JSON.stringify(data);
    }
    return '';
  }

  // 生成报告
  generateReport() {
    const report = {
      summary: {
        totalFiles: this.stats.totalFiles,
        processedFiles: this.stats.processedFiles,
        criticalIssues: this.issues.critical.length,
        warnings: this.issues.warning.length,
        suggestions: this.issues.suggestion.length
      },
      issues: this.issues,
      stats: this.stats
    };
    return report;
  }
}

// ==================== YAML 转换器 ====================
class YAMLConverter {
  constructor(checker) {
    this.checker = checker;
    // 扁平数据：category -> { '分类/条目名': 正文 }
    this.flat = {};
  }

  // 按固定顺序展开全部条目：[[key, content], ...]
  allEntries() {
    const cats = Object.keys(this.flat).sort((a, b) => {
      const ia = CONFIG.categoryOrder.indexOf(a);
      const ib = CONFIG.categoryOrder.indexOf(b);
      return (ia === -1 ? CONFIG.categoryOrder.length : ia) - (ib === -1 ? CONFIG.categoryOrder.length : ib)
        || a.localeCompare(b, 'zh');
    });
    const entries = [];
    for (const cat of cats) {
      for (const key of Object.keys(this.flat[cat]).sort((a, b) => a.localeCompare(b, 'zh'))) {
        entries.push([key, this.flat[cat][key]]);
      }
    }
    return entries;
  }

  // 递归遍历世界书目录
  processAll() {
    console.log('🚀 开始转换 YAML 文件...\n');
    console.log(`📁 根目录: ${CONFIG.inputDir}`);
    this.walkDirectory(CONFIG.inputDir);
    console.log(`\n✅ 处理完成: ${this.checker.stats.processedFiles}/${this.checker.stats.totalFiles} 个文件\n`);
  }

  walkDirectory(dirPath, relParts = []) {
    const items = fs.readdirSync(dirPath).sort();
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        this.walkDirectory(fullPath, relParts.concat(item));
      } else if (item.endsWith('.yaml') || item.endsWith('.txt')) {
        this.checker.stats.totalFiles++;
        try {
          this.processFile(fullPath, relParts.concat(item));
          this.checker.stats.processedFiles++;
        } catch (error) {
          console.error(`❌ 处理失败: ${item} → ${error.message}`);
          this.checker.issues.critical.push({
            file: item,
            issue: `解析失败: ${error.message}`,
            severity: 'critical'
          });
        }
      }
    }
  }

  // 处理单个文件：relParts = ['地理', '势力', '圣火骑士团.yaml']
  processFile(filePath, relParts) {
    const filename = relParts[relParts.length - 1];
    const baseName = filename.replace(/\.(yaml|txt)$/, '');
    const dirParts = relParts.slice(0, -1);
    const category = dirParts[dirParts.length - 1];
    const key = `${category}/${baseName}`;

    // 全部条目按 Markdown 散文处理，不尝试 YAML 结构化解析
    let content = fs.readFileSync(filePath, 'utf8');
    content = stripWrapperTags(content);

    // 数据质量检查（按目录粗分：NPC / 系统 / 其余）
    if (category === 'NPC') {
      this.checker.checkNPC(baseName, content);
    } else if (category === '系统') {
      this.checker.checkSystem(baseName, content);
    } else {
      this.checker.checkWorld(baseName, content);
    }

    if (!this.flat[category]) this.flat[category] = {};
    this.flat[category][key] = content;
    console.log(`   ✓ ${key}`);
  }

  // 生成三个 JS 模块 + 校验输出目录
  generateModules() {
    console.log('\n📝 生成 JS 模块...\n');

    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString();
    this.writeCoreModule(CONFIG.outputs.core, timestamp);
    this.writeNestedModule(['NPC'], CONFIG.outputs.npc, timestamp);
    this.writeNestedModule(
      Object.keys(this.flat).filter((c) => c !== 'NPC'),
      CONFIG.outputs.world,
      timestamp
    );

    console.log('✅ JS 模块生成完成\n');
  }

  // 扁平格式：export const promptData = { '分类/条目名': 正文 }
  writeCoreModule(filename, timestamp) {
    const entries = this.allEntries();
    let content = `/**
 * 灾厄之后·重制版 - 自动生成的提示词数据（扁平格式）
 * 生成时间: ${timestamp}
 * 条目数量: ${entries.length}
 *
 * 警告：此文件由脚本自动生成，请勿手动编辑
 * 如需修改，请编辑 data-source/世界书/ 源 YAML 后重新运行: npm run convert
 */

export const promptData = {
`;
    let lastCat = null;
    for (const [key, value] of entries) {
      const cat = key.split('/')[0];
      if (cat !== lastCat) {
        content += `\n  // ── ${cat} ──\n`;
        lastCat = cat;
      }
      content += `  ${JSON.stringify(key)}: ${JSON.stringify(value)},\n`;
    }
    content += `};

export default promptData;
`;
    const outputPath = path.join(CONFIG.outputDir, filename);
    fs.writeFileSync(outputPath, content, 'utf8');
    console.log(`   ✓ ${filename}（扁平 ${entries.length} 条）→ ${outputPath}`);
  }

  // 嵌套格式（兼容兜底）：export const calamityPrompts = { 分类: { 条目名: 正文 } }
  writeNestedModule(categories, filename, timestamp) {
    const sorted = categories.slice().sort((a, b) => {
      const ia = CONFIG.categoryOrder.indexOf(a);
      const ib = CONFIG.categoryOrder.indexOf(b);
      return (ia === -1 ? CONFIG.categoryOrder.length : ia) - (ib === -1 ? CONFIG.categoryOrder.length : ib)
        || a.localeCompare(b, 'zh');
    });

    let content = `/**
 * 灾厄之后·重制版 - 自动生成的提示词数据（嵌套格式，兜底数据源）
 * 生成时间: ${timestamp}
 *
 * 警告：此文件由脚本自动生成，请勿手动编辑
 * 如需修改，请编辑 data-source/世界书/ 源 YAML 后重新运行: npm run convert
 */

export const calamityPrompts = {
`;
    let count = 0;
    for (const cat of sorted) {
      const items = this.flat[cat] || {};
      content += `  ${JSON.stringify(cat)}: {\n`;
      for (const key of Object.keys(items).sort((a, b) => a.localeCompare(b, 'zh'))) {
        const shortKey = key.split('/').slice(1).join('/');
        content += `    ${JSON.stringify(shortKey)}: ${JSON.stringify(items[key])},\n`;
        count++;
      }
      content += `  },\n`;
    }
    content += `};

// 导出便捷访问函数
export function getPrompt(category, key) {
  return (calamityPrompts[category] || {})[key] || '';
}

export function getAllPrompts(category) {
  return calamityPrompts[category] || {};
}
`;
    const outputPath = path.join(CONFIG.outputDir, filename);
    fs.writeFileSync(outputPath, content, 'utf8');
    console.log(`   ✓ ${filename}（嵌套 ${count} 条）→ ${outputPath}`);
  }
}

// ==================== 报告生成器 ====================
class ReportGenerator {
  constructor(checker, converter) {
    this.checker = checker;
    this.converter = converter;
  }

  generate() {
    console.log('📊 生成数据质量报告...\n');

    // 确保报告目录存在
    if (!fs.existsSync(CONFIG.reportDir)) {
      fs.mkdirSync(CONFIG.reportDir, { recursive: true });
    }

    const report = this.checker.generateReport();
    const markdown = this.generateMarkdown(report);

    const reportPath = path.join(CONFIG.reportDir, CONFIG.outputs.report);
    fs.writeFileSync(reportPath, markdown, 'utf8');

    console.log(`✅ 报告已保存: ${reportPath}\n`);

    // 打印摘要
    this.printSummary(report);
  }

  generateMarkdown(report) {
    const lines = [];

    lines.push('# 灾厄之后·重制版 - 数据质量报告');
    lines.push('');
    lines.push(`> 生成时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push('');

    // 摘要
    lines.push('## 📊 数据摘要');
    lines.push('');
    lines.push('| 指标 | 数量 |');
    lines.push('|------|------|');
    lines.push(`| 总文件数 | ${report.summary.totalFiles} |`);
    lines.push(`| 处理成功 | ${report.summary.processedFiles} |`);
    lines.push(`| 严重问题 | ${report.summary.criticalIssues} |`);
    lines.push(`| 警告 | ${report.summary.warnings} |`);
    lines.push(`| 建议 | ${report.summary.suggestions} |`);
    lines.push('');

    // 严重问题
    if (report.issues.critical.length > 0) {
      lines.push('## 🚨 严重问题（需立即修复）');
      lines.push('');
      for (const issue of report.issues.critical) {
        lines.push(`- **${issue.file}**`);
        if (issue.field) lines.push(`  - 字段: ${issue.field}`);
        lines.push(`  - 问题: ${issue.issue}`);
        lines.push('');
      }
    }

    // 警告
    if (report.issues.warning.length > 0) {
      lines.push('## ⚠️ 警告（建议修复）');
      lines.push('');

      // 按文件分组
      const byFile = {};
      for (const issue of report.issues.warning) {
        if (!byFile[issue.file]) byFile[issue.file] = [];
        byFile[issue.file].push(issue);
      }

      for (const [file, issues] of Object.entries(byFile)) {
        lines.push(`### ${file}`);
        lines.push('');
        for (const issue of issues) {
          if (issue.field) {
            lines.push(`- **${issue.field}**: ${issue.issue}`);
          } else {
            lines.push(`- ${issue.issue}`);
          }
        }
        lines.push('');
      }
    }

    // 建议
    if (report.issues.suggestion.length > 0) {
      lines.push('## 💡 优化建议');
      lines.push('');
      for (const issue of report.issues.suggestion) {
        lines.push(`- **${issue.file}**: ${issue.issue}`);
      }
      lines.push('');
    }

    // 统计详情
    lines.push('## 📈 统计详情');
    lines.push('');
    lines.push(`- 缺失必填字段: ${report.stats.missingRequired} 处`);
    lines.push(`- 内容过短: ${report.stats.shortContent} 处`);
    lines.push(`- 空字段: ${report.stats.emptyFields} 处`);
    lines.push('');

    // 数据完整度评分
    const score = this.calculateScore(report);
    lines.push('## 🎯 数据完整度评分');
    lines.push('');
    lines.push(`**总分: ${score.total}/100**`);
    lines.push('');
    lines.push(`- 必填字段完整性: ${score.required}/40`);
    lines.push(`- 推荐字段完整性: ${score.recommended}/30`);
    lines.push(`- 内容质量: ${score.quality}/30`);
    lines.push('');

    // 建议行动
    lines.push('## 🔧 建议行动');
    lines.push('');
    if (report.summary.criticalIssues > 0) {
      lines.push('1. **优先修复严重问题**（必填字段缺失）');
    }
    if (report.summary.warnings > 10) {
      lines.push('2. **逐步完善警告项**（内容过短、格式不一致）');
    }
    if (report.summary.suggestions > 5) {
      lines.push('3. **考虑优化建议**（添加示例、丰富描述）');
    }
    lines.push('');

    return lines.join('\n');
  }

  calculateScore(report) {
    const critical = report.summary.criticalIssues;
    const warnings = report.summary.warnings;

    // 必填字段完整性（40 分）
    const required = Math.max(0, 40 - (critical * 2));

    // 推荐字段完整性（30 分）
    const recommended = Math.max(0, 30 - (warnings * 0.5));

    // 内容质量（30 分）
    const quality = Math.max(0, 30 - (report.stats.shortContent * 0.3));

    return {
      total: Math.round(required + recommended + quality),
      required: Math.round(required),
      recommended: Math.round(recommended),
      quality: Math.round(quality)
    };
  }

  printSummary(report) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 转换摘要');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`处理文件: ${report.summary.processedFiles}/${report.summary.totalFiles}`);
    console.log(`严重问题: ${report.summary.criticalIssues}`);
    console.log(`警告: ${report.summary.warnings}`);
    console.log(`建议: ${report.summary.suggestions}`);

    const score = this.calculateScore(report);
    console.log(`数据完整度: ${score.total}/100`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (report.summary.criticalIssues > 0) {
      console.log('⚠️  发现严重问题，请查看报告后修复');
    } else if (report.summary.warnings > 10) {
      console.log('⚠️  发现较多警告，建议优化数据质量');
    } else {
      console.log('✅ 数据质量良好，可以继续下一步');
    }
    console.log('');
  }
}

// ==================== 主流程 ====================
async function main() {
  try {
    console.log('\n🎮 灾厄之后·重制版 - 数据转换工具\n');

    // 初始化
    const checker = new DataQualityChecker();
    const converter = new YAMLConverter(checker);

    // 处理所有文件
    converter.processAll();

    // 生成 JS 模块
    converter.generateModules();

    // 生成报告
    const reporter = new ReportGenerator(checker, converter);
    reporter.generate();

    console.log('🎉 转换完成！\n');

  } catch (error) {
    console.error('\n❌ 转换失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行
if (require.main === module) {
  main();
}

module.exports = { YAMLConverter, DataQualityChecker, ReportGenerator, stripWrapperTags };
