import { Link, useNavigate } from "react-router-dom";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "./ui/menubar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import {
  HandPlatter,
  Loader2,
  Menu,
  Moon,
  PackageCheck,
  ShoppingCart,
  SquareMenu,
  Sun,
  User,
  UtensilsCrossed,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Separator } from "./ui/separator";
import { useUserStore } from "@/store/useUserStore";
import { useCartStore } from "@/store/useCartStore";
import { useThemeStore } from "@/store/useThemeStore";

const Navbar = () => {
  const { user, loading, logout } = useUserStore();
  const { cart } = useCartStore();
  const { setTheme } = useThemeStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-orange-500 via-orange-500 to-amber-500 flex items-center justify-center shrink-0 shadow-md shadow-orange-500/30 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 group-hover:shadow-lg group-hover:shadow-orange-500/50">
              <UtensilsCrossed className="h-4 w-4 text-white" />
            </div>
            <h1 className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 bg-[length:200%_auto] bg-clip-text text-transparent transition-all duration-500 group-hover:bg-right">
              Suman Food
            </h1>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <div className="flex items-center gap-1">
              <Link
                to="/"
                className="relative px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-orange-500 dark:hover:text-orange-400 font-medium text-sm transition-colors group"
              >
                Home
                <span className="absolute left-3 right-3 -bottom-0.5 h-0.5 bg-gradient-to-r from-orange-500 to-amber-500 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300 rounded-full" />
              </Link>
              <Link
                to="/profile"
                className="relative px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-orange-500 dark:hover:text-orange-400 font-medium text-sm transition-colors group"
              >
                Profile
                <span className="absolute left-3 right-3 -bottom-0.5 h-0.5 bg-gradient-to-r from-orange-500 to-amber-500 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300 rounded-full" />
              </Link>
              <Link
                to="/order/success"
                className="relative px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-orange-500 dark:hover:text-orange-400 font-medium text-sm transition-colors group"
              >
                Orders
                <span className="absolute left-3 right-3 -bottom-0.5 h-0.5 bg-gradient-to-r from-orange-500 to-amber-500 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300 rounded-full" />
              </Link>

              {/* Dashboard always visible for logged-in users */}
              <Menubar className="border-none bg-transparent p-0">
                <MenubarMenu>
                  <MenubarTrigger className="cursor-pointer px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 font-medium text-sm data-[state=open]:text-orange-500 data-[state=open]:bg-orange-50 dark:data-[state=open]:bg-orange-500/10 rounded-lg transition-all">
                    Dashboard
                  </MenubarTrigger>
                  <MenubarContent className="rounded-xl border-gray-100 dark:border-gray-700 shadow-xl p-1.5">
                    <Link to="/admin/restaurant">
                      <MenubarItem className="cursor-pointer rounded-lg focus:bg-gradient-to-r focus:from-orange-500 focus:to-amber-500 focus:text-white transition-colors">
                        <UtensilsCrossed className="w-4 h-4 mr-2" />
                        Restaurant
                      </MenubarItem>
                    </Link>
                    <Link to="/admin/menu">
                      <MenubarItem className="cursor-pointer rounded-lg focus:bg-gradient-to-r focus:from-orange-500 focus:to-amber-500 focus:text-white transition-colors">
                        <SquareMenu className="w-4 h-4 mr-2" />
                        Menu
                      </MenubarItem>
                    </Link>
                    <Link to="/admin/orders">
                      <MenubarItem className="cursor-pointer rounded-lg focus:bg-gradient-to-r focus:from-orange-500 focus:to-amber-500 focus:text-white transition-colors">
                        <PackageCheck className="w-4 h-4 mr-2" />
                        Orders
                      </MenubarItem>
                    </Link>
                  </MenubarContent>
                </MenubarMenu>
              </Menubar>
            </div>

            <div className="flex items-center gap-3">
              {/* Theme Toggle */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-lg border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-500/50 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-500 hover:rotate-12 transition-all duration-300"
                  >
                    <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl p-1.5">
                  <DropdownMenuItem
                    onClick={() => setTheme("light")}
                    className="rounded-lg cursor-pointer focus:bg-orange-50 dark:focus:bg-orange-500/10 focus:text-orange-600"
                  >
                    <Sun className="w-4 h-4 mr-2" />
                    Light
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme("dark")}
                    className="rounded-lg cursor-pointer focus:bg-orange-50 dark:focus:bg-orange-500/10 focus:text-orange-600"
                  >
                    <Moon className="w-4 h-4 mr-2" />
                    Dark
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Cart */}
              <Link
                to="/cart"
                className="relative cursor-pointer h-9 w-9 flex items-center justify-center rounded-lg hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-all duration-300 hover:scale-110 group"
              >
                <ShoppingCart className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-orange-500 transition-colors" />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-gradient-to-br from-orange-500 to-amber-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm animate-bounce">
                    {cart.length}
                  </span>
                )}
              </Link>

              {/* Avatar */}
              <Link to="/profile" className="group">
                <Avatar className="cursor-pointer h-9 w-9 border-2 border-orange-500 ring-2 ring-orange-100 dark:ring-orange-500/10 transition-all duration-300 group-hover:ring-4 group-hover:ring-orange-200 dark:group-hover:ring-orange-500/20 group-hover:scale-105">
                  <AvatarImage
                    src={user?.profilePicture}
                    alt={user?.fullname || "User"}
                  />
                  <AvatarFallback className="bg-gradient-to-br from-orange-100 to-amber-100 text-orange-600 font-bold text-xs">
                    {getInitials(user?.fullname || "User")}
                  </AvatarFallback>
                </Avatar>
              </Link>

              {/* Logout */}
              {loading ? (
                <Button disabled className="bg-orange-500 rounded-lg">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wait
                </Button>
              ) : (
                <Button
                  onClick={handleLogout}
                  className="relative overflow-hidden bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg shadow-sm shadow-orange-500/20 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/40 hover:scale-105 active:scale-95 group"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative">Logout</span>
                </Button>
              )}
            </div>
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden">
            <MobileNavbar />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navbar;

// ======================= MOBILE NAVBAR =======================

const MobileNavbar = () => {
  const { user, logout, loading } = useUserStore();
  const { cart } = useCartStore();
  const { setTheme } = useThemeStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const linkClass =
    "flex items-center gap-4 hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 dark:hover:from-orange-500/10 dark:hover:to-amber-500/10 hover:text-orange-600 dark:hover:text-orange-400 hover:translate-x-1 px-3 py-3 rounded-xl cursor-pointer text-gray-700 dark:text-gray-300 font-medium transition-all duration-200";

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gradient-to-br hover:from-orange-500 hover:to-amber-500 hover:text-white border border-gray-200 dark:border-gray-700 hover:border-transparent transition-all duration-300"
          variant="outline"
        >
          <Menu size={18} />
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col bg-white dark:bg-gray-900">
        <SheetHeader className="flex flex-row items-center justify-between mt-2">
          <SheetTitle className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shrink-0 shadow-md shadow-orange-500/30">
              <UtensilsCrossed className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent text-xl font-extrabold">
              Suman Food
            </span>
          </SheetTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="rounded-lg border-gray-200 dark:border-gray-700 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-500 transition-all"
              >
                <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem onClick={() => setTheme("light")} className="rounded-lg focus:bg-orange-50 focus:text-orange-600">
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")} className="rounded-lg focus:bg-orange-50 focus:text-orange-600">
                Dark
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SheetHeader>
        <Separator className="my-2" />

        <SheetDescription className="flex-1 space-y-1">
          <Link to="/" className={linkClass}>
            <User className="w-5 h-5" />
            <span>Home</span>
          </Link>
          <Link to="/profile" className={linkClass}>
            <User className="w-5 h-5" />
            <span>Profile</span>
          </Link>
          <Link to="/order/success" className={linkClass}>
            <HandPlatter className="w-5 h-5" />
            <span>Orders</span>
          </Link>
          <Link to="/cart" className={linkClass}>
            <ShoppingCart className="w-5 h-5" />
            <span>Cart ({cart.length})</span>
          </Link>

          {/* Dashboard links always visible */}
          <Separator className="my-3" />
          <p className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
            Dashboard
          </p>
          <Link to="/admin/restaurant" className={linkClass}>
            <UtensilsCrossed className="w-5 h-5" />
            <span>Restaurant</span>
          </Link>
          <Link to="/admin/menu" className={linkClass}>
            <SquareMenu className="w-5 h-5" />
            <span>Menu</span>
          </Link>
          <Link to="/admin/orders" className={linkClass}>
            <PackageCheck className="w-5 h-5" />
            <span>Orders</span>
          </Link>
        </SheetDescription>

        <SheetFooter className="flex flex-col gap-4">
          <div className="flex flex-row items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-500/10 dark:to-amber-500/10">
            <Avatar className="border-2 border-orange-500">
              <AvatarImage src={user?.profilePicture} />
              <AvatarFallback className="bg-orange-100 text-orange-600 font-bold">
                {getInitials(user?.fullname || "User")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="font-bold text-gray-900 dark:text-white truncate">
                {user?.fullname || "User"}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user?.email}
              </p>
            </div>
          </div>
          <SheetClose asChild>
            {loading ? (
              <Button disabled className="bg-orange-500 rounded-lg">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Please wait
              </Button>
            ) : (
              <Button
                onClick={handleLogout}
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-lg shadow-sm shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-95 transition-all duration-300"
              >
                Logout
              </Button>
            )}
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};