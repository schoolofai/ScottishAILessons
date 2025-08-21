#!/usr/bin/env node

/**
 * Template Validation Script
 * Validates the Claude Code Command Template structure and content
 */

const fs = require('fs');
const path = require('path');

class TemplateValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.rootDir = path.resolve(__dirname, '..');
  }

  log(message) {
    console.log(`✅ ${message}`);
  }

  warn(message) {
    console.log(`⚠️  ${message}`);
    this.warnings.push(message);
  }

  error(message) {
    console.log(`❌ ${message}`);
    this.errors.push(message);
  }

  validateFile(filePath, description) {
    const fullPath = path.join(this.rootDir, filePath);
    if (fs.existsSync(fullPath)) {
      this.log(`Found ${description}: ${filePath}`);
      return true;
    } else {
      this.error(`Missing ${description}: ${filePath}`);
      return false;
    }
  }

  validateDirectory(dirPath, description) {
    const fullPath = path.join(this.rootDir, dirPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      this.log(`Found ${description}: ${dirPath}`);
      return true;
    } else {
      this.error(`Missing ${description}: ${dirPath}`);
      return false;
    }
  }

  validateEssentialFiles() {
    console.log('\n🔍 Validating essential files...');
    
    const essentialFiles = [
      ['README.md', 'main README'],
      ['LICENSE', 'license file'],
      ['.gitignore', 'gitignore file'],
      ['CONTRIBUTING.md', 'contributing guidelines'],
      ['CODE_OF_CONDUCT.md', 'code of conduct'],
      ['package.json', 'package configuration']
    ];

    essentialFiles.forEach(([file, desc]) => {
      this.validateFile(file, desc);
    });
  }

  validateClaudeCommands() {
    console.log('\n🔍 Validating Claude commands...');
    
    if (!this.validateDirectory('.claude/commands', 'Claude commands directory')) {
      return;
    }

    const expectedCommands = [
      'create-prd.md',
      'generate-tasks.md',
      'process-task-list.md',
      'resume-task-list.md',
      'create-documentation.md'
    ];

    expectedCommands.forEach(command => {
      const commandPath = `.claude/commands/${command}`;
      if (this.validateFile(commandPath, `Claude command: ${command}`)) {
        this.validateCommandStructure(commandPath);
      }
    });
  }

  validateCommandStructure(commandPath) {
    const fullPath = path.join(this.rootDir, commandPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Check for basic command structure
    if (content.includes('# ') || content.includes('## ')) {
      this.log(`Command ${commandPath} has proper heading structure`);
    } else {
      this.warn(`Command ${commandPath} may be missing proper headings`);
    }

    // Check for essential sections
    const hasGoal = /goal|purpose|overview/i.test(content);
    const hasUsage = /usage|implementation|process/i.test(content);
    
    if (hasGoal && hasUsage) {
      this.log(`Command ${commandPath} has expected sections`);
    } else {
      this.warn(`Command ${commandPath} may be missing expected sections`);
    }
  }

  validateGitHubTemplates() {
    console.log('\n🔍 Validating GitHub templates...');
    
    if (!this.validateDirectory('.github', 'GitHub directory')) {
      return;
    }

    const githubFiles = [
      ['.github/template.yml', 'GitHub template metadata'],
      ['.github/pull_request_template.md', 'PR template'],
      ['.github/ISSUE_TEMPLATE/bug_report.yml', 'bug report template'],
      ['.github/ISSUE_TEMPLATE/feature_request.yml', 'feature request template'],
      ['.github/ISSUE_TEMPLATE/prd_request.yml', 'PRD request template']
    ];

    githubFiles.forEach(([file, desc]) => {
      this.validateFile(file, desc);
    });

    // Validate workflows
    if (this.validateDirectory('.github/workflows', 'GitHub workflows directory')) {
      this.validateFile('.github/workflows/validate-template.yml', 'template validation workflow');
    }
  }

  validateDocumentation() {
    console.log('\n🔍 Validating documentation...');
    
    if (!this.validateDirectory('docs', 'documentation directory')) {
      return;
    }

    const docFiles = [
      ['docs/workflow-guide.md', 'workflow guide'],
      ['docs/command-usage.md', 'command usage guide'],
      ['docs/best-practices.md', 'best practices guide'],
      ['docs/examples/README.md', 'examples documentation']
    ];

    docFiles.forEach(([file, desc]) => {
      this.validateFile(file, desc);
    });
  }

  validateProjectStructure() {
    console.log('\n🔍 Validating project structure...');
    
    const directories = [
      ['tasks', 'tasks workspace'],
      ['scripts', 'utility scripts'],
      ['docs/examples', 'examples directory']
    ];

    directories.forEach(([dir, desc]) => {
      this.validateDirectory(dir, desc);
    });

    // Validate tasks directory has placeholder
    if (fs.existsSync(path.join(this.rootDir, 'tasks'))) {
      if (fs.existsSync(path.join(this.rootDir, 'tasks/.gitkeep'))) {
        this.log('Tasks directory has proper placeholder');
      } else {
        this.warn('Tasks directory missing .gitkeep file');
      }
    }
  }

  validatePackageJson() {
    console.log('\n🔍 Validating package.json...');
    
    const packagePath = path.join(this.rootDir, 'package.json');
    if (!fs.existsSync(packagePath)) {
      this.error('package.json not found');
      return;
    }

    try {
      const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      // Check required fields
      const requiredFields = ['name', 'version', 'description', 'license'];
      requiredFields.forEach(field => {
        if (packageData[field]) {
          this.log(`package.json has ${field}`);
        } else {
          this.error(`package.json missing ${field}`);
        }
      });

      // Check scripts
      if (packageData.scripts) {
        const expectedScripts = ['validate', 'lint:docs', 'lint:commands'];
        expectedScripts.forEach(script => {
          if (packageData.scripts[script]) {
            this.log(`package.json has ${script} script`);
          } else {
            this.warn(`package.json missing ${script} script`);
          }
        });
      }

      // Check keywords
      if (packageData.keywords && packageData.keywords.includes('claude-code')) {
        this.log('package.json has appropriate keywords');
      } else {
        this.warn('package.json may be missing relevant keywords');
      }

    } catch (error) {
      this.error(`Invalid JSON in package.json: ${error.message}`);
    }
  }

  validateReadme() {
    console.log('\n🔍 Validating README.md...');
    
    const readmePath = path.join(this.rootDir, 'README.md');
    if (!fs.existsSync(readmePath)) {
      this.error('README.md not found');
      return;
    }

    const content = fs.readFileSync(readmePath, 'utf8');
    
    // Check for essential sections
    const sections = [
      ['Quick Start', /quick start|getting started/i],
      ['Workflow Overview', /workflow|overview/i],
      ['Commands', /commands|usage/i],
      ['Directory Structure', /directory|structure/i],
      ['Contributing', /contributing/i],
      ['License', /license/i]
    ];

    sections.forEach(([name, regex]) => {
      if (regex.test(content)) {
        this.log(`README has ${name} section`);
      } else {
        this.warn(`README may be missing ${name} section`);
      }
    });

    // Check for command table
    if (content.includes('| Command |') || content.includes('`/create-prd`')) {
      this.log('README includes command documentation');
    } else {
      this.warn('README may be missing command documentation');
    }
  }

  run() {
    console.log('🚀 Starting Claude Code Command Template validation...\n');
    
    this.validateEssentialFiles();
    this.validateClaudeCommands();
    this.validateGitHubTemplates();
    this.validateDocumentation();
    this.validateProjectStructure();
    this.validatePackageJson();
    this.validateReadme();
    
    // Summary
    console.log('\n📊 Validation Summary:');
    console.log(`✅ Validation completed`);
    
    if (this.warnings.length > 0) {
      console.log(`⚠️  ${this.warnings.length} warnings found`);
    }
    
    if (this.errors.length > 0) {
      console.log(`❌ ${this.errors.length} errors found`);
      console.log('\nErrors:');
      this.errors.forEach(error => console.log(`  - ${error}`));
      process.exit(1);
    } else {
      console.log('🎉 Template validation passed!');
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new TemplateValidator();
  validator.run();
}

module.exports = TemplateValidator;