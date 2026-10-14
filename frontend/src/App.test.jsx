// @vitest-environment jsdom
import React from "react";
import {afterEach, beforeEach, expect, test, vi} from "vitest";
import {cleanup, render, screen, fireEvent, waitFor} from "@testing-library/react";
import {App} from "./main.jsx";

const file={path:"core.py",language:"Python",lines:3,score:100,symbols:[{name:"run",kind:"function",line:1}],imports:[],findings:[],complexity:[{name:"run",line:1,cyclomatic_estimate:2,review_priority:"low"}]};
const report={project:"Uploaded project",summary:{files:1,lines:3,symbols:1,dependencies:1,high_risks:0,average_score:100,languages:{Python:1}},files:[file],recommendations:["Add characterization tests."],documentation:"# Uploaded documentation",change_impact:{modules:[{changed_file:"core.py",affected_count:1,affected:[{file:"api.py",distance:1,path:["core.py","api.py"],evidence:[{source:"api.py",line:2,import:"core"}]}]}],edges:[],unresolved_imports:[],unsupported_files:[]}};
beforeEach(()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>report}));});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});

test("file selection, filtering, dependency inspection and documentation are interactive",async()=>{
  render(<App/>);
  await screen.findByText("Uploaded project");
  fireEvent.click(screen.getByRole("button",{name:/core.py/}));
  expect(screen.getByText(/2 estimated paths/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Filter files"),{target:{value:"missing"}});
  expect(screen.getByText("No files match your filter.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"dependencies"}));
  expect(screen.getByText("core.py → api.py")).toBeTruthy();
  expect(screen.getByText("api.py:2 imports core")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"documentation"}));
  expect(screen.getByText("# Uploaded documentation")).toBeTruthy();
});

test("ZIP upload sends the visitor's file to the real analysis endpoint",async()=>{
  render(<App/>);
  await screen.findByText("Uploaded project");
  const input=screen.getByLabelText("Upload source ZIP");
  const zip=new File(["zip bytes"],"own-code.zip",{type:"application/zip"});
  fireEvent.change(input,{target:{files:[zip]}});
  await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));
  const [url,options]=fetch.mock.calls[1];
  expect(url).toContain("/api/analyze");
  expect(options.method).toBe("POST");
  expect(options.body.get("file").name).toBe("own-code.zip");
});

test("invalid uploads show a useful error without making another request",async()=>{
  render(<App/>);
  await screen.findByText("Uploaded project");
  fireEvent.change(screen.getByLabelText("Upload source ZIP"),{target:{files:[new File(["hello"],"notes.txt")]}});
  expect(screen.getByText("Choose a ZIP archive no larger than 15 MB.")).toBeTruthy();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("JSON and documentation exports create actual downloads",async()=>{
  const create=vi.fn().mockReturnValue("blob:report");
  const revoke=vi.fn();
  URL.createObjectURL=create;URL.revokeObjectURL=revoke;
  const click=vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>{});
  render(<App/>);
  await screen.findByText("Uploaded project");
  fireEvent.click(screen.getByRole("button",{name:"Export JSON"}));
  fireEvent.click(screen.getByRole("button",{name:"Download documentation"}));
  expect(create).toHaveBeenCalledTimes(2);
  expect(click).toHaveBeenCalledTimes(2);
});

test("a backend failure is shown rather than disguised as an empty success",async()=>{
  fetch.mockResolvedValue({ok:false,json:async()=>({detail:"Archive contains an unsafe path"})});
  render(<App/>);
  expect(await screen.findByText("Archive contains an unsafe path")).toBeTruthy();
});
