import { describe, expect, it, type jest, spyOn } from "bun:test";
import * as childProcess from "node:child_process";
import * as vscode from "vscode";

import { activate } from "./extension.ts";

spyOn(vscode.commands, "registerCommand");
spyOn(vscode.commands, "executeCommand");
spyOn(vscode.window, "showInformationMessage");
spyOn(vscode.window, "showOpenDialog");
spyOn(vscode.window, "showInputBox");
spyOn(vscode.window, "showQuickPick");
spyOn(vscode.window, "withProgress");
spyOn(childProcess, "execFile");

const extensionContext = {
  subscriptions: [],
} as unknown as vscode.ExtensionContext;

describe("extension", () => {
  describe("activation", () => {
    it("creates a bun project and opens it", async () => {
      (childProcess.execFile as unknown as jest.Mock).mockImplementation(
        (
          _cmd: string,
          _args: string[],
          thirdArg: unknown,
          fourthArg?: unknown,
        ) => {
          if (typeof thirdArg === "function") {
            (thirdArg as (err: null, stdout: string) => void)(null, "");
          } else if (typeof fourthArg === "function") {
            (fourthArg as (err: null, stdout: string, stderr: string) => void)(
              null,
              "",
              "",
            );
          }
        },
      );
      (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue([
        { fsPath: "/tmp" },
      ]);
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue("my-app");
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({
        value: { bunInitFlags: ["--yes"] },
      });
      (vscode.window.withProgress as jest.Mock).mockImplementation(
        (_opts: unknown, task: (p: unknown, t: unknown) => Promise<unknown>) =>
          task({}, {}),
      );

      activate(extensionContext);

      const command = (vscode.commands.registerCommand as jest.Mock).mock
        .calls[0][0];
      const callback = (vscode.commands.registerCommand as jest.Mock).mock
        .calls[0][1] as () => Promise<void>;
      expect(command).toBe("vscode-create-bun.createBunProject");

      await callback();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        "vscode.openFolder",
        { fsPath: "/tmp/my-app" },
        false,
      );
    });
  });
});
