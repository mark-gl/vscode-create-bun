import * as childProcess from "node:child_process";
import * as path from "node:path";
import * as vscode from "vscode";

type BunTemplateChoice = {
  label: string;
  description: string;
  bunInitFlags: string[];
};

const DEFAULT_TEMPLATE_CHOICE: BunTemplateChoice = {
  label: "Blank",
  description: "Accept Bun defaults",
  bunInitFlags: ["--yes"],
};

export const activate = (context: vscode.ExtensionContext) => {
  const createBunProjectDisposable = vscode.commands.registerCommand(
    "vscode-create-bun.createBunProject",
    async () => {
      const getBunTemplateLabel = (flag: string): string => {
        const trimmedFlag = flag.startsWith("--") ? flag.slice(2) : flag;

        const uppercaseFirstLetter = (value: string) =>
          value.charAt(0).toUpperCase() + value.slice(1);

        return trimmedFlag.startsWith("react=")
          ? `React (${uppercaseFirstLetter(trimmedFlag.slice("react=".length))})`
          : uppercaseFirstLetter(trimmedFlag);
      };

      const loadBunTemplateChoices = async (): Promise<BunTemplateChoice[]> => {
        const parseChoice = (
          helpLine: string,
        ): BunTemplateChoice | undefined => {
          const trimmedHelpLine = helpLine.trim();
          if (!trimmedHelpLine.startsWith("-")) {
            return undefined;
          }

          const descriptionStart = trimmedHelpLine.indexOf("  ");
          if (descriptionStart === -1) {
            return undefined;
          }

          const description = trimmedHelpLine.slice(descriptionStart).trim();
          if (!description) {
            return undefined;
          }

          const flag = trimmedHelpLine
            .slice(0, descriptionStart)
            .trim()
            .split(",")
            .map((part) => part.trim())
            .find((part) => part.startsWith("--"));

          if (!flag || flag === "--help" || flag === "--yes") {
            return undefined;
          }

          if (!description.toLowerCase().includes("initialize")) {
            return undefined;
          }

          return {
            label: getBunTemplateLabel(flag),
            description,
            bunInitFlags: [flag],
          };
        };

        return new Promise((resolve) => {
          childProcess.execFile(
            "bun",
            ["init", "--help"],
            (error: Error | null, stdout: string) => {
              if (error) {
                resolve([DEFAULT_TEMPLATE_CHOICE]);
                return;
              }

              const discoveredChoices = stdout
                .split("\n")
                .map(parseChoice)
                .filter(
                  (choice): choice is BunTemplateChoice => choice !== undefined,
                );

              resolve([DEFAULT_TEMPLATE_CHOICE, ...discoveredChoices]);
            },
          );
        });
      };

      const selectedFolders = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Select Folder",
      });
      if (!selectedFolders || selectedFolders.length === 0) {
        return;
      }
      const parentFolderPath = selectedFolders[0].fsPath;

      const projectNameInput = await vscode.window.showInputBox({
        prompt: "Enter a name for your Bun project",
        placeHolder: "my-app",
        validateInput: (value) => {
          if (value.trim().length === 0) {
            return "Project name is required.";
          }

          return undefined;
        },
      });
      if (!projectNameInput) {
        return;
      }
      const projectName = projectNameInput.trim();

      const templateChoices = await loadBunTemplateChoices();
      const selectedTemplate = await vscode.window.showQuickPick(
        templateChoices.map((choice) => ({
          label: choice.label,
          description: choice.description,
          value: choice,
        })),
        {
          title: "Select a Bun project template",
          placeHolder: "Choose a template",
        },
      );
      const selectedTemplateChoice = selectedTemplate?.value;
      if (!selectedTemplateChoice) {
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Creating Bun project "${projectName}"...`,
          },
          async () => {
            const bunInitArgs = [
              "init",
              ...selectedTemplateChoice.bunInitFlags,
              projectName,
            ];

            await new Promise<void>((resolve, reject) => {
              childProcess.execFile(
                "bun",
                bunInitArgs,
                { cwd: parentFolderPath },
                (error: Error | null, _stdout: string, stderr: string) => {
                  if (error) {
                    reject(new Error(stderr.trim() || error.message));
                    return;
                  }

                  resolve();
                },
              );
            });
          },
        );

        const createdProjectFolderPath = path.join(
          parentFolderPath,
          projectName,
        );

        await vscode.commands.executeCommand(
          "vscode.openFolder",
          vscode.Uri.file(createdProjectFolderPath),
          false,
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to create Bun project.",
        );
      }
    },
  );

  context.subscriptions.push(createBunProjectDisposable);
};

export const deactivate = () => {};
