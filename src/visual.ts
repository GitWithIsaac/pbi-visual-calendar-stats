/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {
    // powerbi.visuals
    import ISelectionId = powerbi.visuals.ISelectionId;

    import valueFormatter = powerbi.extensibility.utils.formatting.valueFormatter;

    import TooltipEventArgs = powerbi.extensibility.utils.tooltip.TooltipEventArgs;
    import ITooltipServiceWrapper = powerbi.extensibility.utils.tooltip.ITooltipServiceWrapper;
    import createTooltipServiceWrapper = powerbi.extensibility.utils.tooltip.createTooltipServiceWrapper;

    // // selection interaction libs
    import createInteractivityService = powerbi.extensibility.utils.interactivity.createInteractivityService;
    import ISelectionHandler = powerbi.extensibility.utils.interactivity.ISelectionHandler;
    import SelectableDataPoint = powerbi.extensibility.utils.interactivity.SelectableDataPoint;
    import IInteractiveBehavior = powerbi.extensibility.utils.interactivity.IInteractiveBehavior;
    import IInteractivityService = powerbi.extensibility.utils.interactivity.IInteractivityService;
    
    // ViewModel
    interface CalendarViewModel {
        dataPoints: CalendarDataPoint[];
        month: number;
        year: number;
        settings: CalendarSettings;
        hasHighlights: boolean;
        error: CalendarError;
    };

    interface CalendarDay {
        day: number,
        week: number,
        data: CalendarDataPoint
    };

    interface MeasureValue {
        value: number;
        valueText: string;
        displayName: string;
    }

    interface CalendarDataPoint extends SelectableDataPoint {
        measures: MeasureValue[];   // positional, one per bound measure field
        category: string;
        rowdata: any;
        key: string;
        highlight?: boolean;
        selectionId: ISelectionId;
    };

    interface CalendarSettings {
        monthYearDisplay: string;
        weekdayFormat: string;
        weekStartDay: number;
        borderWidth: number;
        borderColor: Fill;
        fontColor: Fill;
        fontWeight: number;
        textSize: number;
        monthAlignment: string;
        weekAlignment: string;
        dayAlignment: string;
        calendarColors: ColorSettings;
        dataLabels: DataLabelSettings;
        weekNumbers: WeekNumberSettings;
        measureColors: MeasureColorSettings;
        legend: LegendSettings;
        backgroundStat: BackgroundStatSettings;
    };

    interface ColorSettings {
        colorType: string;
        diverging: boolean;
        startColor: Fill;
        centerColor: Fill;
        endColor: Fill;
        minValue: number;
        centerValue: number;
        maxValue: number;
        noDataColor: Fill;
    };

    interface DataLabelSettings {
        show: boolean;
        unit?: number;
        precision?: number;
        fontColor: Fill;
        fontWeight: number;
        textSize: number;
        alignment: string;
    };

    interface WeekNumberSettings {
        show: boolean;
        useIso: boolean;
        placement: string;
        fontColor: Fill;
        fontWeight: number;
        textSize: number;
        alignment: string;
    }

    interface MeasureColorSettings {
        color1: Fill;
        color2: Fill;
        color3: Fill;
        color4: Fill;
        color5: Fill;
    }

    interface LegendSettings {
        show: boolean;
        position: string;
    }

    interface BackgroundStatSettings {
        enabled: boolean;
        measureIndex: number;
    }

    interface CalendarError {
        hasError: boolean;
        errorMessage: string;
    }

    function visualTransform(options: VisualUpdateOptions, host: IVisualHost): CalendarViewModel {
        let dataViews = options.dataViews;
        let defaultSettings: CalendarSettings = {
            monthYearDisplay: 'monthYear',
            weekdayFormat: 'short',
            weekStartDay: 0,
            borderWidth: 1,
            borderColor: {
                solid: {
                    color: '#000'
                }
            },
            fontColor: {
                solid: {
                    color: '#000'
                }
            },
            fontWeight: 100,
            textSize: 10,
            monthAlignment: 'center',
            weekAlignment: 'center',
            dayAlignment: 'right',
            calendarColors: {
                colorType: 'gradient',
                diverging: false,
                startColor: {
                    solid: {
                        color: null
                    }
                },
                centerColor: {
                    solid: {
                        color: null
                    }
                },
                endColor: {
                    solid: {
                        color: null
                    }
                },
                minValue: null,
                centerValue: null,
                maxValue: null,
                noDataColor: {
                    solid: {
                        color: null
                    }
                }
            },
            dataLabels: {
                show: true,
                unit: 0,
                fontColor: {
                    solid: {
                        color: '#000'
                    }
                },
                fontWeight: 100,
                textSize: 8,
                alignment: 'center'
            },
            weekNumbers: {
                show: false,
                useIso: false,
                placement: 'left',
                fontColor: {
                    solid: {
                        color: '#000'
                    }
                },
                fontWeight: 100,
                textSize: 8,
                alignment: 'center'
            },
            measureColors: {
                color1: { solid: { color: '#2563eb' } },
                color2: { solid: { color: '#16a34a' } },
                color3: { solid: { color: '#dc2626' } },
                color4: { solid: { color: '#9333ea' } },
                color5: { solid: { color: '#ea580c' } }
            },
            legend: {
                show: true,
                position: 'right'
            },
            backgroundStat: {
                enabled: false,
                measureIndex: 0
            }
        };
        let viewModel: CalendarViewModel = {
            dataPoints: [],
            month: null,
            year: null,
            settings: <CalendarSettings>{},
            hasHighlights: false,
            error: <CalendarError>{ hasError: false }
        };

        if (!dataViews
            || !dataViews[0]
            || !dataViews[0].categorical
            || !dataViews[0].categorical.categories
            || !dataViews[0].categorical.categories[0].source
            || !dataViews[0].categorical.values
            || dataViews[0].categorical.categories[0].values.length == 0) {
            return viewModel;
        }

        if (!dataViews[0].categorical.categories[0].source.type.dateTime) {
            viewModel.error.hasError = true;
            viewModel.error.errorMessage = 'Invalid \'Date Field\' column used. Please select a valid Date field.';
            return viewModel;
        }

        let categorical = dataViews[0].categorical;
        let category = categorical.categories[0];
        let objects = dataViews[0].metadata.objects;
        let colorPalette: IColorPalette = host.colorPalette;
        let calendarDataPoints: CalendarDataPoint[] = [];
        let firstDate: Date = new Date(<any>(category.values[0] || category.values[1]));
        let month: number = firstDate.getMonth();
        let year: number = firstDate.getFullYear();
        let tabledata = dataViews[0].table.rows; // used for tooltips
        let calendarSettings: CalendarSettings = {
            monthYearDisplay: getValue<string>(objects, 'calendar', 'monthYearDisplay', defaultSettings.monthYearDisplay),
            weekdayFormat: getValue<string>(objects, 'calendar', 'weekdayFormat', defaultSettings.weekdayFormat),
            weekStartDay: getValue<number>(objects, 'calendar', 'weekStartDay', defaultSettings.weekStartDay),
            borderWidth: getValue<number>(objects, 'calendar', 'borderWidth', defaultSettings.borderWidth),
            borderColor: getValue<Fill>(objects, 'calendar', 'borderColor', defaultSettings.borderColor),
            fontColor: getValue<Fill>(objects, 'calendar', 'fontColor', defaultSettings.fontColor),
            fontWeight: getValue<number>(objects, 'calendar', 'fontWeight', defaultSettings.fontWeight),
            textSize: getValue<number>(objects, 'calendar', 'textSize', defaultSettings.textSize),
            monthAlignment: getValue<string>(objects, 'calendar', 'monthAlignment', defaultSettings.monthAlignment),
            weekAlignment: getValue<string>(objects, 'calendar', 'weekAlignment', defaultSettings.weekAlignment),
            dayAlignment: getValue<string>(objects, 'calendar', 'dayAlignment', defaultSettings.dayAlignment),
            calendarColors: {
                colorType: getValue<string>(objects, 'calendarColors', 'colorType', defaultSettings.calendarColors.colorType),
                diverging: getValue<boolean>(objects, 'calendarColors', 'diverging', defaultSettings.calendarColors.diverging),
                startColor: getValue<Fill>(objects, 'calendarColors', 'startColor', defaultSettings.calendarColors.startColor),
                centerColor: getValue<Fill>(objects, 'calendarColors', 'centerColor', defaultSettings.calendarColors.centerColor),
                endColor: getValue<Fill>(objects, 'calendarColors', 'endColor', defaultSettings.calendarColors.endColor),
                minValue: getValue<number>(objects, 'calendarColors', 'minValue', defaultSettings.calendarColors.minValue),
                centerValue: getValue<number>(objects, 'calendarColors', 'centerValue', defaultSettings.calendarColors.centerValue),
                maxValue: getValue<number>(objects, 'calendarColors', 'maxValue', defaultSettings.calendarColors.maxValue),
                noDataColor: getValue<Fill>(objects, 'calendarColors', 'noDataColor', defaultSettings.calendarColors.noDataColor)
            },
            dataLabels: {
                show: getValue<boolean>(objects, 'dataLabels', 'show', defaultSettings.dataLabels.show),
                unit: getValue<number>(objects, 'dataLabels', 'unit', defaultSettings.dataLabels.unit),
                precision: getValue<number>(objects, 'dataLabels', 'precision', defaultSettings.dataLabels.precision),
                fontColor: getValue<Fill>(objects, 'dataLabels', 'fontColor', defaultSettings.dataLabels.fontColor),
                fontWeight: getValue<number>(objects, 'dataLabels', 'fontWeight', defaultSettings.dataLabels.fontWeight),
                textSize: getValue<number>(objects, 'dataLabels', 'textSize', defaultSettings.dataLabels.textSize),
                alignment: getValue<string>(objects, 'dataLabels', 'alignment', defaultSettings.dataLabels.alignment)
            },
            weekNumbers: {
                show: getValue<boolean>(objects, 'showWeeks', 'show', defaultSettings.weekNumbers.show),
                useIso: getValue<boolean>(objects, 'showWeeks', 'useIso', defaultSettings.weekNumbers.useIso),
                placement: getValue<string>(objects, 'showWeeks', 'placement', defaultSettings.weekNumbers.placement),
                fontColor: getValue<Fill>(objects, 'showWeeks', 'fontColor', defaultSettings.weekNumbers.fontColor),
                fontWeight: getValue<number>(objects, 'showWeeks', 'fontWeight', defaultSettings.weekNumbers.fontWeight),
                textSize: getValue<number>(objects, 'showWeeks', 'textSize', defaultSettings.weekNumbers.textSize),
                alignment: getValue<string>(objects, 'showWeeks', 'alignment', defaultSettings.weekNumbers.alignment)
            },
            measureColors: {
                color1: getValue<Fill>(objects, 'measureColors', 'color1', defaultSettings.measureColors.color1),
                color2: getValue<Fill>(objects, 'measureColors', 'color2', defaultSettings.measureColors.color2),
                color3: getValue<Fill>(objects, 'measureColors', 'color3', defaultSettings.measureColors.color3),
                color4: getValue<Fill>(objects, 'measureColors', 'color4', defaultSettings.measureColors.color4),
                color5: getValue<Fill>(objects, 'measureColors', 'color5', defaultSettings.measureColors.color5),
            },
            legend: {
                show: getValue<boolean>(objects, 'legend', 'show', defaultSettings.legend.show),
                position: getValue<string>(objects, 'legend', 'position', defaultSettings.legend.position)
            },
            backgroundStat: {
                enabled: getValue<boolean>(objects, 'backgroundStat', 'enabled', defaultSettings.backgroundStat.enabled),
                measureIndex: parseInt(getValue<string>(objects, 'backgroundStat', 'measureIndex', '0'), 10) || 0
            }
        };

        // purge date (category) field from table data by checking for Date type
        for (let r = 0; r < tabledata.length; r++) {
            let row = tabledata[r];
            for (let v = 0; v < row.length; v++) {
                let val = row[v];
                if (Object.prototype.toString.call(val) === '[object Date]') {
                    row.splice(v, 1);
                    break;
                }
            }
        }

        for (let i = 0, len = category.values.length; i < len; i++) {
            if (!category.values[i]) continue;

            let selectionIdBuilder = host.createSelectionIdBuilder().withCategory(category, i);
            let selectionId = selectionIdBuilder.createSelectionId();
            let highlight: any = categorical.values[0].highlights && categorical.values[0].highlights[i] !== null;

            let measures: MeasureValue[] = categorical.values.filter(col => col.source.roles['measure']).map((col) => {
                let textFormat = valueFormatter.create({
                    value: calendarSettings.dataLabels.unit,
                    precision: calendarSettings.dataLabels.precision,
                    format: valueFormatter.getFormatStringByColumn(col.source)
                });
                return {
                    value: col.values[i] !== null ? parseFloat(String(col.values[i])) : NaN,
                    valueText: textFormat.format(col.values[i]),
                    displayName: col.source.displayName
                };
            });

            // Note: selectionId is constructed three times here (selectionId, key, and the
            // inline one in the push). This mirrors the original codebase pattern exactly —
            // do not consolidate unless you are refactoring the whole selection system.
            calendarDataPoints.push({
                category: <string>category.values[i],
                measures: measures,
                rowdata: tabledata[i],
                selected: false,
                identity: selectionId,
                key: (selectionIdBuilder.createSelectionId() as ISelectionId).getKey(),
                highlight: highlight,
                selectionId: host.createSelectionIdBuilder()
                    .withCategory(category, i)
                    .createSelectionId()
            });
        }

        viewModel.dataPoints = calendarDataPoints;
        viewModel.month = month;
        viewModel.year = year;
        viewModel.settings = calendarSettings;
        viewModel.hasHighlights = !!(categorical.values[0] && categorical.values[0].highlights);

        return viewModel;
    }

    export class Visual implements IVisual {
        private target: HTMLElement;
        private host: IVisualHost;
        private locale: string;
        private calendar: any;
        private table: d3.Selection<HTMLElement>;
        private calendarSettings: CalendarSettings;
        private selectionManager: ISelectionManager;
        private selectionIdBuilder: ISelectionIdBuilder;
        private tooltipServiceWrapper: ITooltipServiceWrapper;
        private vm: CalendarViewModel;
        private calendarDays: CalendarDay[];
        private calendarDataPoints: CalendarDataPoint[];
        private interactivityService: IInteractivityService;
        private behavior: CalendarBehavior;
        private className: string = 'bci-calendar';
        
        private calendarSelection: d3.Selection<CalendarDay>;

        static Config = {
            defaultOpacity: 1,
            dimmedOpacity: 0.4
        };

        constructor(options: VisualConstructorOptions) {
            this.target = options.element;
            this.host = options.host;
            this.locale = options.host.locale;
            this.selectionManager = options.host.createSelectionManager();

            // adds report bookmarks support
            this.selectionManager.registerOnSelectCallback(() => {
                this.syncSelectionState(this.calendarSelection, this.selectionManager.getSelectionIds() as ISelectionId[]);
            });
            
            this.table = d3.select(options.element);

            this.tooltipServiceWrapper = createTooltipServiceWrapper(
                this.host.tooltipService,
                options.element);

            this.behavior = new CalendarBehavior();
            this.interactivityService = createInteractivityService(options.host);
        }

        public update(options: VisualUpdateOptions) {
            let viewModel: CalendarViewModel = this.vm = visualTransform(options, this.host);
            let settings = this.calendarSettings = viewModel.settings;
            this.calendarDataPoints = viewModel.dataPoints;

            let margins = {
                top: 0,
                right: 2.5,
                bottom: 5,
                left: 2.5
            };
            let width = options.viewport.width - (margins.right + margins.left);
            let height = options.viewport.height - (margins.top + margins.bottom);

            this.table.selectAll('*').remove();
            this.calendar = bciCalendar.loadCalendar(this.table, viewModel, this.calendarSettings, this.selectionManager, this.host.allowInteractions);

            // Apply explicit pixel height so the table expands to fill the visual.
            // Width is handled by CSS (width: 100%), but height: 100% on <table> is unreliable
            // without an explicit height on the container chain, so we set it directly.
            this.table.select('table.bci-calendar').style('height', height + 'px');

            if (viewModel.error.hasError) return;

            let cols = options.dataViews[0].metadata.columns.filter(c => !c.roles['category']).map(c => c);
            this.tooltipServiceWrapper.addTooltip(this.table.selectAll('[id^=bci-calendar]'),
                (tooltipEvent: TooltipEventArgs<CalendarDataPoint>) => 
                    Visual.getTooltipData(<CalendarDataPoint>tooltipEvent.data, cols, this.locale, viewModel.settings.dataLabels.unit, viewModel.settings.dataLabels.precision),
                (tooltipEvent: TooltipEventArgs<CalendarDataPoint>) => null);

            this.calendarSelection = this.table.selectAll('.notempty');

            this.syncSelectionState(this.calendarSelection, this.selectionManager.getSelectionIds() as ISelectionId[]);

            if (this.interactivityService) {
                this.interactivityService.applySelectionStateToData(this.vm.dataPoints);

                let behaviorOptions: CalendarBehaviorOptions = {
                    container: this.table,
                    dayCells: d3.selectAll('[id^=' + this.className + ']'),
                    interactivityService: this.interactivityService,
                    hasHighlights: this.vm.hasHighlights,
                    calendarVisual: this,
                    selectionManager: this.selectionManager,
                    calendarSelection: this.calendarSelection,
                    allowInteractions: this.host.allowInteractions
                };

                this.interactivityService.bind(this.vm.dataPoints, this.behavior, behaviorOptions);
            }

            this.behavior.renderSelection(this.interactivityService.hasSelection());
        }

        public destroy(): void {
            //TODO: Perform any cleanup tasks here
        }

        private static parseSettings(dataView: DataView): VisualSettings {
            return VisualSettings.parse(dataView) as VisualSettings;
        }

        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
            let objectName = options.objectName;
            let objectEnumeration: VisualObjectInstance[] = [];

            switch (objectName) {
                case 'calendar': 
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            monthYearDisplay: this.calendarSettings.monthYearDisplay,
                            weekdayFormat: this.calendarSettings.weekdayFormat,
                            weekStartDay: this.calendarSettings.weekStartDay,
                            borderWidth: this.calendarSettings.borderWidth,
                            borderColor: this.calendarSettings.borderColor,
                            fontColor: this.calendarSettings.fontColor,
                            fontWeight: this.calendarSettings.fontWeight,
                            textSize: this.calendarSettings.textSize,
                            monthAlignment: this.calendarSettings.monthAlignment,
                            weekAlignment: this.calendarSettings.weekAlignment,
                            dayAlignment: this.calendarSettings.dayAlignment
                        },
                        selector: null
                    })
                    break;
                case 'showWeeks':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            show: this.calendarSettings.weekNumbers.show,
                            useIso: this.calendarSettings.weekNumbers.useIso,
                            placement: this.calendarSettings.weekNumbers.placement,
                            fontColor: this.calendarSettings.weekNumbers.fontColor,
                            fontWeight: this.calendarSettings.weekNumbers.fontWeight,
                            textSize: this.calendarSettings.weekNumbers.textSize,
                            alignment: this.calendarSettings.weekNumbers.alignment
                        },
                        selector: null
                    });
                    break;
                case 'calendarColors':
                    const calendarColors = this.calendarSettings.calendarColors;
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            colorType: calendarColors.colorType,
                            diverging: calendarColors.diverging,
                            startColor: calendarColors.startColor.solid.color !== null ? calendarColors.startColor : null,
                            centerColor: calendarColors.centerColor.solid.color !== null ? calendarColors.centerColor : null,
                            endColor: calendarColors.endColor.solid.color !== null ? calendarColors.endColor : null,
                            minValue: calendarColors.minValue,
                            centerValue: calendarColors.centerValue,
                            maxValue: calendarColors.maxValue,
                            noDataColor: calendarColors.noDataColor.solid.color !== null ? calendarColors.noDataColor : null
                        },
                        selector: null
                    });
                    let object: VisualObjectInstance = objectEnumeration[0];
                    if (!calendarColors.diverging) {
                        if (calendarColors.colorType === 'gradient') {
                            delete object.properties.centerColor;
                            delete object.properties.centerValue;
                        } else {
                            delete object.properties.centerColor;
                            delete object.properties.minValue;
                            delete object.properties.maxValue;                            
                        }
                    }
                    break;
                case 'dataLabels':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            show: this.calendarSettings.dataLabels.show,
                            unit: this.calendarSettings.dataLabels.unit,
                            precision: this.calendarSettings.dataLabels.precision,
                            fontColor: this.calendarSettings.dataLabels.fontColor,
                            fontWeight: this.calendarSettings.dataLabels.fontWeight,
                            textSize: this.calendarSettings.dataLabels.textSize,
                            alignment: this.calendarSettings.dataLabels.alignment
                        },
                        selector: null
                    });
                    break;
                case 'measureColors':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            color1: this.calendarSettings.measureColors.color1,
                            color2: this.calendarSettings.measureColors.color2,
                            color3: this.calendarSettings.measureColors.color3,
                            color4: this.calendarSettings.measureColors.color4,
                            color5: this.calendarSettings.measureColors.color5
                        },
                        selector: null
                    });
                    break;
                case 'legend':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            show: this.calendarSettings.legend.show,
                            position: this.calendarSettings.legend.position
                        },
                        selector: null
                    });
                    break;
                case 'backgroundStat':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            enabled: this.calendarSettings.backgroundStat.enabled,
                            measureIndex: String(this.calendarSettings.backgroundStat.measureIndex)
                        },
                        selector: null
                    });
                    break;
            };

            return objectEnumeration;
        }

        private static getTooltipData(value: any, cols: any, locale: string, displayUnit: number, precision: number): VisualTooltipDataItem[] {
            var zip = rows => rows[0].map((_, c) => rows.map(row => row[c]));
            var tooltips = [];
            if (value.data != null && value.data.measures && value.data.measures.length > 0 && !isNaN(value.data.measures[0].value)) {
                var tooltipdata = zip([cols, value.data.rowdata]);
                var date = new Date(value.data.category).toLocaleDateString(locale);
                tooltipdata.forEach((t) => {
                    let format = valueFormatter.create({
                        format: valueFormatter.getFormatStringByColumn(t[0]),
                        value: displayUnit,
                        precision: precision
                    });
                    let temp = {};

                    // If value is the Measure Data field, 
                    // then apply the Display Unit and Decimal Places 
                    // settings to the formatted value.
                    // Otherwise, just use the fields format string
                    let value;
                    if (t[0].roles.measure) {
                        value = format.format(t[1]);
                    } else {
                        value = valueFormatter.format(t[1], format.options.format);
                    }

                    temp['header'] = date;
                    temp['displayName'] = t[0].displayName;
                    temp['value'] = value;
                    tooltips.push(temp);
                })
            } else {
                tooltips.push({ 'displayName': 'No Data' });
            }
            return tooltips;
        }

        public syncSelectionState(selection: d3.Selection<CalendarDay>, selectionIds: ISelectionId[]): void {
            if (!selection || !selectionIds) {
                return;
            }

            if (!selectionIds.length) {
                selection.style('opacity', null);
                return;
            }

            const self: this = this;

            selection.each(function(calendarDay: CalendarDay) {
                const isSelected: boolean = self.isSelectionIdInArray(selectionIds, calendarDay.data.selectionId);

                d3.select(this).style(
                    "opacity",
                    isSelected
                        ? Visual.Config.defaultOpacity
                        : Visual.Config.dimmedOpacity
                );
            });
        }

        private isSelectionIdInArray(selectionIds: ISelectionId[], selectionId: ISelectionId): boolean {
            if (!selectionIds || !selectionId) {
                return false;
            }

            return selectionIds.some((currentSelectionId: ISelectionId) => {
                return currentSelectionId.includes(selectionId);
            });
        }
    }

    export interface CalendarBehaviorOptions {
        container: d3.Selection<HTMLElement>;
        dayCells: d3.Selection<any>;
        interactivityService: IInteractivityService;
        hasHighlights: boolean;
        calendarVisual: Visual;
        selectionManager: ISelectionManager;
        calendarSelection: d3.Selection<CalendarDay>;
        allowInteractions: boolean;
    }

    export class CalendarBehavior implements IInteractiveBehavior {
        private static DimmedOpacity: number = 0.4;
        private static DefaultOpacity: number = 1.0;

        private static getFillOpacity(selected: boolean, highlight: boolean, hasSelection: boolean, hasPartialHighlights: boolean): number {
            if ((hasPartialHighlights && !highlight) || (hasSelection && !selected)) {
                return CalendarBehavior.DimmedOpacity;
            } else {
                return CalendarBehavior.DefaultOpacity;
            }
        }

        private options: CalendarBehaviorOptions;

        public bindEvents(options: CalendarBehaviorOptions, selectionHandler: ISelectionHandler) {
            this.options = options;
            let calendar = options.calendarVisual;
            let selectionManager = options.selectionManager;
            let calendarSelection = options.calendarSelection;
            let allowInteractions = options.allowInteractions;

            options.dayCells.on('click', (d: any) => {
                if (allowInteractions) {
                    const isCtrlPressed: boolean = (d3.event as MouseEvent).ctrlKey;
                    selectionHandler.handleSelection(d.data, isCtrlPressed);
                    selectionManager
                        .select(d.selectionId, isCtrlPressed)
                        .then((ids: ISelectionId[]) => {
                            calendar.syncSelectionState(calendarSelection, ids);
                        });
                    
                    (<Event>d3.event).stopPropagation();
                }
            });

            options.container.on('click', d => {
                if (allowInteractions) {
                    selectionManager
                        .clear()
                        .then(() => {
                            calendar.syncSelectionState(calendarSelection, []);
                        });
                }
            })
        }

        public renderSelection(hasSelection: boolean) {
            let options = this.options;
            let hasHighlights = options.hasHighlights;

            options.dayCells.style('opacity', (d: any) => {
                let selected = d.data ? d.data.selected : false;
                let highlight = d.data ? d.data.highlight : false;

                return CalendarBehavior.getFillOpacity(selected, highlight, !highlight && hasSelection, !selected && hasHighlights);
            });
        }
    }
}