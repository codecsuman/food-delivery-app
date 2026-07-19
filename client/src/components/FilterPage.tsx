import { useEffect } from "react";
import { useRestaurantStore } from "@/store/useRestaurantStore";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { SlidersHorizontal, RotateCcw, X } from "lucide-react";

export type FilterOptionsState = {
  id: string;
  label: string;
};

const toOptions = (values: string[]): FilterOptionsState[] =>
  values.map((label) => ({
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
  }));

const FilterPage = () => {
  const {
    setAppliedFilter,
    appliedFilter,
    resetAppliedFilter,
    filterOptions,
    getFilterOptions,
  } = useRestaurantStore();

  useEffect(() => {
    getFilterOptions();
  }, [getFilterOptions]);

  const cuisineOptions = toOptions(filterOptions.cuisines);
  const dishOptions = toOptions(filterOptions.dishes);

  const appliedFilterHandler = (value: string) => {
    setAppliedFilter(value);
  };

  const renderOptionGroup = (options: FilterOptionsState[]) => {
    if (options.length === 0) {
      return (
        <p className="text-xs text-gray-400 dark:text-gray-500 px-2.5 py-1.5">
          None yet
        </p>
      );
    }

    return options.map((option) => {
      const isChecked = appliedFilter.includes(option.label);
      return (
        <div
          key={option.id}
          className={`flex items-center space-x-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
            isChecked
              ? "bg-orange-50 dark:bg-orange-500/10"
              : "hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
          onClick={() => appliedFilterHandler(option.label)}
        >
          <Checkbox
            id={option.id}
            checked={isChecked}
            onCheckedChange={() => appliedFilterHandler(option.label)}
            className="border-gray-300 dark:border-gray-600 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
          />
          <Label
            htmlFor={option.id}
            className={`text-sm cursor-pointer flex-1 transition-colors ${
              isChecked
                ? "font-semibold text-orange-600 dark:text-orange-400"
                : "font-medium text-gray-700 dark:text-gray-300"
            }`}
          >
            {option.label}
          </Label>
        </div>
      );
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 h-fit">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
            <SlidersHorizontal className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <h1 className="font-semibold text-base text-gray-900 dark:text-white leading-tight">
              Filter
            </h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Cuisine & dishes
            </p>
          </div>
        </div>
        {appliedFilter.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetAppliedFilter}
            className="text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Reset
          </Button>
        )}
      </div>

      <div className="mb-2">
        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
          Cuisine
        </p>
        <div className="space-y-1.5">{renderOptionGroup(cuisineOptions)}</div>
      </div>

      <div className="mt-5">
        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
          Popular dishes
        </p>
        <div className="space-y-1.5">{renderOptionGroup(dishOptions)}</div>
      </div>

      {appliedFilter.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2.5">
            {appliedFilter.length} filter{appliedFilter.length > 1 ? "s" : ""} applied
          </p>
          <div className="flex flex-wrap gap-1.5">
            {appliedFilter.map((filter) => (
              <span
                key={filter}
                onClick={() => appliedFilterHandler(filter)}
                className="text-xs font-medium pl-2.5 pr-1.5 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full flex items-center gap-1 cursor-pointer hover:opacity-90 transition-opacity"
              >
                {filter}
                <X className="w-3 h-3" />
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterPage;