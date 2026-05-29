import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "../../lib/utils";
import { useSidebarStore } from "../../store/sidebarStore";
import { ChevronDown } from "lucide-react";

export interface SidebarSubItem {
  label: string;
  href: string;
}

export interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  isActive?: boolean;
  endDecorator?: React.ReactNode;
  onNavigate?: () => void;
  disabled?: boolean;
  subItems?: SidebarSubItem[];
}

export function SidebarItem({ 
  icon: Icon, 
  label, 
  href, 
  isActive, 
  endDecorator, 
  onNavigate, 
  disabled,
  subItems 
}: SidebarItemProps) {
  const { isMobile } = useSidebarStore();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  
  const isDesktop = !isMobile;

  // Check if this item or any of its sub-items is active
  const isCurrentlyActive = isActive !== undefined 
    ? isActive 
    : (href === "/admin" && location.pathname === "/admin") || 
      (href === "/client" && location.pathname === "/client") ||
      (href !== "/admin" && href !== "/client" && location.pathname.startsWith(href));

  const hasSubItems = subItems && subItems.length > 0;

  const hasActiveSubItem = hasSubItems && subItems.some(
    (item) => location.pathname + location.search === item.href || location.pathname === item.href.split('?')[0]
  );
  const showSubItems = isOpen || hasActiveSubItem;

  if (disabled) {
    return (
      <div
        className={cn(
          "flex items-center rounded-md px-3 py-2 text-sm font-medium mb-1 whitespace-nowrap overflow-hidden transition-all duration-300",
          "text-muted-foreground opacity-60 cursor-not-allowed select-none",
          isDesktop && "justify-center px-2 group-hover:justify-start group-hover:px-3"
        )}
        title={isDesktop ? `${label} (Em breve)` : undefined}
      >
        <Icon className={cn("h-5 w-5 shrink-0 transition-all", isDesktop ? "group-hover:mr-3" : "mr-3")} />
        <span className={cn("flex-1 text-left truncate transition-all duration-300", isDesktop && "hidden group-hover:block")}>
          {label}
        </span>
      </div>
    );
  }

  const handleToggle = () => {
    if (hasSubItems) {
      // Permite a navegação natural (sem preventDefault)
      // E garante que o menu fique aberto ao ser clicado
      setIsOpen(true);
    }
  };

  return (
    <div className="flex flex-col">
      <NavLink
        to={href}
        onClick={() => {
          if (hasSubItems) {
            handleToggle();
          }
          // Sempre chama onNavigate para fechar o menu mobile, etc.
          onNavigate?.();
        }}
        className={cn(
          "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors mb-1 whitespace-nowrap overflow-hidden transition-all duration-300",
          isCurrentlyActive 
            ? "bg-primary text-primary-foreground shadow-sm" 
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          isDesktop && "justify-center px-2 group-hover:justify-start group-hover:px-3"
        )}
        title={isDesktop && !hasSubItems ? label : undefined}
      >
        <Icon className={cn("h-5 w-5 shrink-0 transition-all", isDesktop ? "group-hover:mr-3" : "mr-3")} />
        <span className={cn("flex-1 text-left truncate transition-all duration-300", isDesktop && "hidden group-hover:block")}>
          {label}
        </span>
        
        {hasSubItems && (
          <ChevronDown className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200",
            showSubItems && "rotate-180",
            isDesktop && "hidden group-hover:block"
          )} />
        )}

        {endDecorator && !hasSubItems && (
          <div className={cn(isDesktop && "hidden group-hover:block")}>
            {endDecorator}
          </div>
        )}
      </NavLink>

      {/* Sub-items list */}
      {hasSubItems && showSubItems && (
        <div className={cn(
          "flex flex-col overflow-hidden mb-1",
          isDesktop && "hidden group-hover:flex"
        )}>
          {subItems.map((sub, idx) => {
            const isSubActive = location.pathname + location.search === sub.href;
            return (
              <NavLink
                key={idx}
                to={sub.href}
                onClick={() => onNavigate?.()}
                className={cn(
                  "flex items-center py-1.5 px-3 pl-11 text-[13px] font-medium rounded-md transition-colors",
                  isSubActive 
                    ? "text-primary bg-primary/10" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {sub.label}
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
