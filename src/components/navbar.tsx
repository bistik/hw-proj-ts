import { authClient } from "@/lib/auth-client";
import { Link, useNavigate } from "@tanstack/react-router";

export default function Navbar() {
  const navigate = useNavigate();
  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          navigate({ to: "/login" });
        },
      },
    });
  };

  return (
    <div className="navbar bg-base-100 shadow-sm">
      <div className="flex-1">
        <Link to="/dashboard" className="btn btn-ghost text-xl">
          LDH
        </Link>
      </div>
      <div className="flex flex-1 gap-2">
        <Link to="/dashboard" className="link inline-flex">
          Dashboard
        </Link>
        <Link to="/courses" className="link inline-flex">
          Courses
        </Link>
        <Link to="/assignments" className="link inline-flex">
          Assignments
        </Link>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search"
          className="input w-24 md:w-auto"
        />
        <div className="dropdown dropdown-end">
          <div
            tabIndex={0}
            role="button"
            className="btn btn-ghost btn-circle avatar"
          >
            <div className="w-10 rounded-full">
              <img
                alt="Navbar"
                src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"
              />
            </div>
          </div>
          <ul
            tabIndex={-1}
            className="menu menu-sm dropdown-content bg-base-100 rounded-box z-1 mt-3 w-52 p-2 shadow"
          >
            <li>
              <Link to="." onClick={handleLogout}>
                Logout
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
