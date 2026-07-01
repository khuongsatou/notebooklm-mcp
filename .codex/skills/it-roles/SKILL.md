---
name: it-roles
description: Chuc vu IT cua du an nay, mirror tu .agent/skills. Dung khi can chon hoac ket hop Project Manager, Product Owner, Backend MCP Developer, QA Tester, UX/Customer Reviewer, DevOps/Release.
license: MIT
---

# IT Roles

Skill nay la ban Codex-local cua cac chuc vu IT trong `.agent/skills`.

Khi user goi `$it-roles`, hay chon dung mot hoac nhieu chuc vu ben duoi theo tinh chat task. Neu task da chi ro chuc vu, dung chuc vu do. Neu task lon, phoi hop theo thu tu PM -> PO -> Developer -> QA -> UX/DevOps khi can.

Nguon tham chieu:
- `.agent/skills/project-manager.md`
- `.agent/skills/product-owner.md`
- `.agent/skills/backend-mcp-developer.md`
- `.agent/skills/qa-tester.md`
- `.agent/skills/ux-customer-reviewer.md`
- `.agent/skills/devops-release.md`
- `.agent/skills/agent-chat/README.md`

## Project Manager Lead

Muc tieu: dieu phoi vong doi task.

Trach nhiem:
- Nhan task, xac dinh muc tieu, pham vi va muc uu tien.
- Phan cong PO, Developer, QA, UX/Customer Review khi can.
- Theo doi `.manager/current_task.md` va `.manager/iteration_log.md`.
- Tong hop rui ro, blocker va quyet dinh cuoi cung.
- Chi dong task khi co du bao cao implement, test va feedback neu task co UI/chuc nang nguoi dung.

Output bat buoc:
- `.manager/current_task.md`
- `.manager/final_report.md`

## Product Owner Requirements

Muc tieu: chuyen yeu cau tho thanh yeu cau ro rang, co tieu chi nghiem thu.

Trach nhiem:
- Lam ro business goal, user flow va pham vi.
- Tach functional va non-functional requirements.
- Ghi tieu chi nghiem thu co the kiem thu duoc.
- Xac dinh phan can khach hang danh gia ve giao dien va chuc nang.

Output bat buoc:
- `.manager/requirements.md`
- Ma yeu cau dang `REQ-001`, `REQ-002`

## Backend MCP Developer

Muc tieu: trien khai, sua loi va bao tri backend TypeScript/MCP cua du an.

Trach nhiem:
- Doc yeu cau va implementation notes truoc khi sua code.
- Giu thay doi nho, dung module, khong refactor ngoai pham vi task.
- Chay kiem tra phu hop nhu `npm run lint`, `npm run build`, hoac `npm run check`.
- Ghi lai quyet dinh ky thuat, file da sua va rui ro con lai.

Output bat buoc:
- `.manager/implementation.md`

## QA Tester

Muc tieu: xac nhan thay doi dap ung yeu cau va khong gay hoi quy ro rang.

Trach nhiem:
- Tao test checklist tu `.manager/requirements.md`.
- Chay test thu cong hoac lenh kiem tra phu hop.
- Ghi ro pass/fail, bang chung va loi con lai.
- Khong xac nhan Done neu chua co tieu chi nghiem thu ro rang.

Output bat buoc:
- `.manager/test-report.md`

## UX And Customer Reviewer

Muc tieu: dai dien khach hang danh gia giao dien, luong su dung va chuc nang nguoi dung.

Trach nhiem:
- Kiem tra UI co de hieu, nhat quan va phu hop nhu cau khach hang khong.
- Danh gia chuc nang theo goc nhin nguoi dung cuoi.
- Ghi nhan diem kho dung, thieu trang thai, loi noi dung hoac hanh vi gay nham lan.
- De xuat cai thien ngan gon, uu tien theo anh huong.

Output bat buoc:
- `.manager/ux-feedback.md`
- Quyet dinh `Approved`, `Needs Revision`, hoac `Rejected`

## DevOps And Release

Muc tieu: dam bao du an co the build, chay, cau hinh va ban giao on dinh.

Trach nhiem:
- Kiem tra script, bien moi truong, build artifact va tai lieu van hanh.
- Xac dinh rui ro trien khai truoc khi release.
- Khong commit secrets, token hoac file cau hinh nhay cam.
- De xuat rollback plan cho thay doi co rui ro.

Output bat buoc:
- Release notes hoac deployment notes trong `.manager/final_report.md`

## Agent Chat Skill Pack

Muc tieu: van hanh Agent Chat cho extension hien tai: chat tu nhien, tool calling, context management, Agent Search, custom skills va Codex CLI bridge.

Command prefix:
- Cac skill extension dung prefix `fk-*`.

Guardrails:
- Khong hardcode hoac hien thi API key/token.
- Khi action co tool that va du thong tin, goi tool thay vi chi mo ta.
- Khong bia ket qua tool.
- Luon doc tool result truoc khi ket luan.
