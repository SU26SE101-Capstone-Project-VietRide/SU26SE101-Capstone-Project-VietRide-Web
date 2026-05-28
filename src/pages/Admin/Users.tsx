import { FiSearch, FiFilter } from "react-icons/fi";
import { useState } from "react";
import Modal from "../../components/Modal";
import { users as mockUsers } from "../../data/mockData";

function formatUserId(idx: number) {
  return `U-${10020 + idx}`;
}

export default function Users() {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState(mockUsers);
  const [selected, setSelected] = useState<number | null>(null);

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  function openDetails(idx: number) {
    setSelected(idx);
  }

  function closeDetails() {
    setSelected(null);
  }

  function saveUser(idx: number, patch: Partial<(typeof users)[number]>) {
    setUsers((prev) =>
      prev.map((u, i) => (i === idx ? { ...u, ...patch } : u)),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Quản lý người dùng
          </h1>
          <p className="text-gray-600 mt-1">
            Tài khoản khách hàng, manager và phân quyền.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm theo email, tên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-100 rounded-lg focus:outline-none text-sm bg-gray-50"
            />
          </div>

          <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 flex items-center gap-2">
            <FiFilter /> Bộ lọc
          </button>

          <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700">
            Cột hiển thị
          </button>

          <div className="ml-auto">
            <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700">
              Xuất CSV
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  User ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  Họ tên
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  Vai trò
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  Tham gia
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  Chuyến
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  Trạng thái
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const idx = users.findIndex((x) => x.id === u.id);
                return (
                  <tr
                    key={u.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition"
                  >
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {formatUserId(idx + 1)}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {u.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {u.email}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {u.role}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {u.createdAt ?? "--"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {(idx + 1) * 5}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {u.active ? (
                        <span className="px-3 py-1 bg-vr-100 text-vr-900 rounded-full text-xs">
                          Active
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                          Khóa
                        </span>
                      )}
                      <div className="mt-2">
                        <button
                          onClick={() => openDetails(idx)}
                          className="text-sm text-vr-600 hover:underline"
                        >
                          Chi tiết
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-sm text-gray-500">
          Hiển thị {filtered.length} / 1240000 bản ghi
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="px-3 py-2 bg-white border border-gray-200 rounded-lg">
            Trước
          </button>
          <button className="px-3 py-2 bg-vr-500 text-slate-900 rounded-lg font-semibold hover:bg-vr-600">
            1
          </button>
          <button className="px-3 py-2 bg-white border border-gray-200 rounded-lg">
            2
          </button>
          <button className="px-3 py-2 bg-white border border-gray-200 rounded-lg">
            3
          </button>
          <button className="px-3 py-2 bg-white border border-gray-200 rounded-lg">
            Sau
          </button>
        </div>
      </div>
      <Modal
        open={selected !== null}
        onClose={closeDetails}
        title={selected !== null ? users[selected].name : "Chi tiết"}
        subtitle={selected !== null ? users[selected].email : undefined}
      >
        {selected !== null && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Vai trò
              </label>
              <select
                value={users[selected].role}
                onChange={(e) =>
                  saveUser(selected, { role: e.target.value as any })
                }
                className="w-full px-3 py-2 border rounded"
              >
                <option value="customer">Khách hàng</option>
                <option value="manager">Manager</option>
                <option value="operator">Operator</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Trạng thái
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => saveUser(selected, { active: true })}
                  className={`px-3 py-2 rounded ${users[selected].active ? "bg-vr-500 text-white" : "bg-white border"}`}
                >
                  Kích hoạt
                </button>
                <button
                  onClick={() => saveUser(selected, { active: false })}
                  className={`px-3 py-2 rounded ${!users[selected].active ? "bg-red-50 text-red-700" : "bg-white border"}`}
                >
                  Khóa
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Ghi chú
              </label>
              <textarea
                className="w-full px-3 py-2 border rounded min-h-20"
                placeholder="Ghi chú nội bộ"
              />
            </div>
          </div>
        )}
        <div />
      </Modal>
    </div>
  );
}
