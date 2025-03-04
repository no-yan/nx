import { type Compiler, sources, type WebpackPluginInstance } from 'webpack';
import {
  ExecutorContext,
  type ProjectGraph,
  serializeJson,
} from '@nrwl/devkit';
import { createPackageJson } from '@nrwl/workspace/src/utilities/create-package-json';

import type { BuildNodeBuilderOptions } from './types';
import {
  getHelperDependenciesFromProjectGraph,
  HelperDependency,
} from '@nrwl/js/src/utils/compiler-helper-dependency';
import { readTsConfig } from '@nrwl/workspace/src/utilities/typescript';

export class GeneratePackageJsonWebpackPlugin implements WebpackPluginInstance {
  constructor(
    private readonly context: ExecutorContext,
    private readonly projectGraph: ProjectGraph,
    private readonly options: BuildNodeBuilderOptions
  ) {}

  apply(compiler: Compiler): void {
    const pluginName = this.constructor.name;

    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'nx-generate-package-json-plugin',
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          const helperDependencies = getHelperDependenciesFromProjectGraph(
            this.context.root,
            this.context.projectName
          );

          const importHelpers = !!readTsConfig(this.options.tsConfig).options
            .importHelpers;
          const shouldAddHelperDependency =
            importHelpers &&
            helperDependencies.every(
              (dep) => dep.target !== HelperDependency.tsc
            );

          if (shouldAddHelperDependency) {
            helperDependencies.push({
              type: 'static',
              source: this.context.projectName,
              target: HelperDependency.tsc,
            });
          }

          if (helperDependencies.length > 0) {
            this.projectGraph.dependencies[this.context.projectName] =
              this.projectGraph.dependencies[this.context.projectName].concat(
                helperDependencies
              );
          }

          const packageJson = createPackageJson(
            this.context.projectName,
            this.projectGraph,
            this.options
          );

          packageJson.main = packageJson.main ?? this.options.outputFileName;

          delete packageJson.devDependencies;

          compilation.emitAsset(
            'package.json',
            new sources.RawSource(serializeJson(packageJson))
          );
        }
      );
    });
  }
}
